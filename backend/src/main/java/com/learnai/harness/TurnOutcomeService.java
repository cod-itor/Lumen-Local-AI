package com.learnai.harness;

import com.learnai.entity.GuardEvent;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.TurnMetrics;
import com.learnai.harness.task.TaskHandlers;
import com.learnai.repository.GuardEventRepository;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.TurnMetricsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.JsonNodeFactory;

import java.util.UUID;

/** Side effects of terminal turns and the per-turn metrics row (BACKEND.md §7.4 step 5, §7.9). */
@Slf4j
@Service
@RequiredArgsConstructor
public class TurnOutcomeService {

    private final HarnessTurnRepository turns;
    private final TurnMetricsRepository metrics;
    private final GuardEventRepository guardEvents;
    private final TaskHandlers handlers;
    private final PlatformTransactionManager txManager;

    /** Store the AI service's `guardEvents[]` (prepare or finalize) for this turn (GUARDRAILS.md §11). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveGuardEvents(UUID turnId, JsonNode events) {
        if (events == null || !events.isArray() || events.isEmpty()) return;
        try {
            HarnessTurn t = turns.findById(turnId).orElse(null);
            if (t == null) return;
            for (JsonNode e : events) {
                guardEvents.save(GuardEvent.builder()
                        .userId(t.getUserId()).turnId(turnId)
                        .stage(cut(e.path("stage").asString("INPUT"), 6))
                        .action(cut(e.path("action").asString("BLOCK"), 14))
                        .categories(e.path("categories").isArray() ? e.get("categories")
                                : JsonNodeFactory.instance.arrayNode())
                        .rule(cut(e.path("rule").asString("classifier"), 80))
                        .excerpt(cut(e.path("excerpt").asString(""), 300))
                        .providerKind(t.getProviderKind().name()).model(cut(t.getModel(), 100))
                        .profile(cut(e.path("profile").asString("STANDARD"), 8))
                        .build());
            }
        } catch (RuntimeException ex) {
            log.warn("guard events failed for turn {}", turnId, ex);
        }
    }

    private static String cut(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }

    /** FAILED / EXPIRED / CANCELLED. MESSAGE turns have no side effects beyond metrics. */
    public void onTerminal(UUID turnId) {
        try {
            TransactionTemplate own = new TransactionTemplate(txManager);
            own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            own.executeWithoutResult(s -> {
                HarnessTurn t = turns.findById(turnId).orElse(null);
                if (t != null && t.getStatus().isTerminal()) {
                    handlers.get(t.getTask()).ifPresent(h -> h.onTerminal(t, t.getStatus()));
                }
            });
        } catch (RuntimeException e) {
            log.warn("task side effects failed for turn {}", turnId, e);
        }
        try {
            TransactionTemplate own = new TransactionTemplate(txManager);
            own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
            own.executeWithoutResult(s -> write(turnId, null, null, null));
        } catch (RuntimeException e) {
            log.warn("onTerminal failed for turn {}", turnId, e);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeMetrics(UUID turnId, JsonNode finalizeMetrics, JsonNode stats, String finishReason) {
        try {
            write(turnId, finalizeMetrics, stats, finishReason);
        } catch (RuntimeException e) {
            log.warn("metrics failed for turn {}", turnId, e);
        }
    }

    private void write(UUID turnId, JsonNode fin, JsonNode stats, String finish) {
        if (metrics.existsById(turnId)) return;
        HarnessTurn t = turns.findById(turnId).orElse(null);
        if (t == null) return;
        JsonNode ctx = t.getPrepareContext();
        JsonNode cm = ctx == null ? null : ctx.path("metrics");
        metrics.save(TurnMetrics.builder()
                .turnId(t.getId()).userId(t.getUserId()).task(t.getTask().name())
                .pipeline(text(ctx, "pipeline")).providerKind(t.getProviderKind().name()).model(t.getModel())
                .rulesVersion(text(ctx, "rulesVersion")).inputLanguage(text(ctx, "inputLanguage"))
                .outputLanguage(text(ctx, "outputLanguage"))
                .estimatedPromptTokens(integer(cm, "estimatedPromptTokens"))
                .actualPromptTokens(integer(stats, "promptTokens")).outputTokens(integer(stats, "outputTokens"))
                .ttftMs(integer(stats, "ttftMs")).tokensPerSec(real(stats, "tokensPerSec"))
                .totalMs(integer(stats, "totalMs")).finishReason(finish)
                .guardInputAction(ctx == null ? null : text(ctx.path("inputGuard"), "action"))
                .guardOutputAction(text(fin, "guardOutputAction")).groundingLevel(text(fin, "groundingLevel"))
                .supportedRatio(real(fin, "supportedRatio")).topSim(real(cm, "topSim"))
                .chunksUsed(cm != null && cm.hasNonNull("chunksUsed") ? (short) cm.get("chunksUsed").asInt() : null)
                .abstainedBeforeModel(cm != null && cm.path("abstainedBeforeModel").asBoolean(false))
                .jsonAttempts(fin != null && fin.hasNonNull("jsonAttempts") ? (short) fin.get("jsonAttempts").asInt()
                        : null)
                .status(turns.findById(turnId).map(x -> x.getStatus().name()).orElse("FAILED"))
                .build());
    }

    private static String text(JsonNode n, String f) {
        return n == null || !n.hasNonNull(f) ? null : n.get(f).asString();
    }

    private static Integer integer(JsonNode n, String f) {
        return n == null || !n.hasNonNull(f) ? null : n.get(f).asInt();
    }

    private static Float real(JsonNode n, String f) {
        return n == null || !n.hasNonNull(f) ? null : (float) n.get(f).asDouble();
    }
}
