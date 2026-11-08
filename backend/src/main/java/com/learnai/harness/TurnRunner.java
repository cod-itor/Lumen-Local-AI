package com.learnai.harness;

import com.learnai.client.AiEvent;
import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.config.AppProperties;
import com.learnai.dto.response.MessageDto;
import com.learnai.entity.Chat;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.Message;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.MessageStatus;
import com.learnai.entity.enums.Tab;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.mapper.MessageMapper;
import com.learnai.repository.ChatRepository;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.MessageRepository;
import com.learnai.service.ProviderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Runs one turn on a virtual thread (BACKEND.md §7.3). Never throws; always ends the stream. */
@Slf4j
@Component
@RequiredArgsConstructor
public class TurnRunner {

    private static final List<TurnStatus> PREP = List.of(TurnStatus.PREPARING);

    private final HarnessTurnRepository turns;
    private final ChatRepository chats;
    private final MessageRepository messages;
    private final TurnStore store;
    private final TurnFinalizer finalizer;
    private final TurnOutcomeService outcomes;
    private final TurnRegistry registry;
    private final TurnContext ctx;
    private final HistoryBuilder history;
    private final ProviderService providers;
    private final AiServiceClient ai;
    private final MessageMapper mapper;
    private final ObjectMapper json;
    private final AppProperties props;

    public void run(UUID turnId, TurnRegistry.Handle h) {
        SseWriter w = h.writer;
        try {
            prepareAndGenerate(turnId, h, w);
        } catch (AiServiceException e) {
            failOpen(turnId, w, e.getCode(), e.getMessage(), e.isRetryable());
        } catch (RuntimeException e) {
            log.error("turn {} failed", turnId, e);
            failOpen(turnId, w, "INTERNAL_ERROR", "Something went wrong. Please try again.", true);
        } finally {
            registry.remove(turnId);
            w.complete();
        }
    }

    private void prepareAndGenerate(UUID turnId, TurnRegistry.Handle h, SseWriter w) {
        HarnessTurn t = turns.findById(turnId).orElseThrow();
        ModelProvider p = providers.loadFresh(t.getUserId(), t.getProviderId());
        Message user = t.getUserMessageId() == null ? null : messages.findById(t.getUserMessageId()).orElse(null);
        Map<String, Object> started = new LinkedHashMap<>();
        started.put("turnId", t.getId());
        started.put("task", t.getTask());
        started.put("generation", t.getGeneration());
        started.put("userMessage", user == null ? null : mapper.toDto(user));
        started.put("expiresAt", t.getExpiresAt());
        w.send("turn", started);

        Chat chat = chats.findById(t.getChatId()).orElseThrow();
        ObjectNode req = prepareRequest(t, p, chat, user);
        for (AiEvent ev : ai.prepare(req).takeUntilOther(h.cancel.asMono()).toIterable()) {
            JsonNode d = ev.data();
            switch (ev.name()) {
                case "status" -> w.send("status", d);
                case "sources" -> w.send("sources", publicSources(d));
                case "tools" -> w.send("tools", d);
                case "blocked" -> {
                    outcomes.saveGuardEvents(turnId, d.path("guardEvents"));
                    prepareTimeAnswer(t, d, true, w);
                    return;
                }
                case "abstained" -> {
                    prepareTimeAnswer(t, d, false, w);
                    return;
                }
                case "needs_approval" -> {
                    store.savePrepared(turnId, d.path("context"), null);
                    if (!w.isOpen() || !store.transition(turnId, TurnStatus.AWAITING_APPROVAL, TurnStatus.PREPARING)) {
                        cancelIfOpen(turnId, w);
                        return;
                    }
                    w.finish("approval", Map.of("turnId", turnId, "kind", "SEARCH_QUERY",
                            "content", d.path("query").asString("")));
                    return;
                }
                case "prepared" -> {
                    outcomes.saveGuardEvents(turnId, d.path("guardEvents"));
                    prepared(t, p, d, h, w);
                    return;
                }
                case "error" -> {
                    failOpen(turnId, w, d.path("code").asString("AI_ERROR"),
                            d.path("message").asString("The AI service failed."), d.path("retryable").asBoolean(true));
                    return;
                }
                default -> log.debug("ignoring prepare event {}", ev.name());
            }
        }
        if (h.cancelRequested.get()) cancelIfOpen(turnId, w);
        else failOpen(turnId, w, "AI_SERVICE_UNAVAILABLE", "The AI service stopped unexpectedly.", true);
    }

    private ObjectNode prepareRequest(HarnessTurn t, ModelProvider p, Chat chat, Message user) {
        JsonNode r = t.getRequest();
        ObjectNode req = json.createObjectNode().put("turnId", t.getId().toString()).put("task", t.getTask().name())
                .put("attempt", (int) t.getAttempt());
        req.set("user", ctx.user(t));
        req.set("provider", ctx.provider(p));
        ObjectNode c = req.putObject("chat").put("id", chat.getId().toString()).put("tab", chat.getTab().name());
        var docs = c.putArray("documentIds");
        if (chat.getTab() == Tab.DOCS) chat.getDocumentIds().forEach(d -> docs.add(d.toString()));
        ObjectNode in = req.putObject("input").put("content", user == null ? "" : user.getContent())
                .put("webSearch", chat.getTab() == Tab.CHAT && r.path("webSearch").asBoolean(false));
        in.set("approvedQuery", r.path("approvedQuery").isString() ? r.get("approvedQuery") : json.nullNode());
        HistoryBuilder.History hist = history.build(chat.getId(), user == null ? null : user.getParentId());
        req.set("history", json.valueToTree(hist.messages()));
        req.put("previousUserMessage", hist.previousUserMessage());
        req.putNull("taskInput");
        return req;
    }

    /** `blocked` / `abstained` decided at prepare time: saved through the MESSAGE handler (§7.3). */
    private void prepareTimeAnswer(HarnessTurn t, JsonNode d, boolean blocked, SseWriter w) {
        JsonNode context = d.path("context");
        MessageStatus ms;
        TurnStatus ts;
        ObjectNode guard = json.createObjectNode();
        if (blocked) {
            boolean support = "SUPPORT".equals(d.path("action").asString());
            ms = support ? MessageStatus.COMPLETE : MessageStatus.BLOCKED;
            ts = TurnStatus.BLOCKED;
            guard.put("action", support ? "SUPPORT" : "BLOCK");
            guard.set("categories", d.path("categories"));
        } else {
            ms = MessageStatus.ABSTAINED;
            ts = TurnStatus.ABSTAINED;
            guard.put("action", context.path("inputGuard").path("action").asString("ALLOW"));
            guard.set("categories", json.createArrayNode());
        }
        guard.put("profile", ctx.guardProfile(t, ctx.settings(t.getUserId())).name());
        ObjectNode grounding = json.createObjectNode().put("level", blocked ? "NOT_APPLICABLE" : "ABSTAINED")
                .put("supportedRatio", 0).put("removedUrls", 0).put("removedCitations", 0)
                .put("hasSpecificFacts", false);
        grounding.putArray("sentences");
        MessageDto msg = store.applyMessage(t.getId(), PREP, ts, new TurnStore.MessageResult(
                d.path("content").asString(""), d.path("originalContent").asString(null), d.path("translations"), ms,
                guard, grounding, blocked ? json.createArrayNode() : d.path("suggestions"), null, null), context);
        if (msg == null) {
            cancelIfOpen(t.getId(), w);
            return;
        }
        outcomes.writeMetrics(t.getId(), null, null, null);
        if (blocked) {
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("action", d.path("action").asString("BLOCK"));
            ev.put("message", msg);
            ev.put("refusal", d.path("content").asString(""));
            ev.put("categories", d.path("categories"));
            w.finish("blocked", ev);
        } else {
            w.finish("abstained", Map.of("message", msg));
        }
    }

    private void prepared(HarnessTurn t, ModelProvider p, JsonNode d, TurnRegistry.Handle h, SseWriter w) {
        UUID id = t.getId();
        store.savePrepared(id, d.path("context"), d.path("messages"));
        Duration ttl = Duration.ofMinutes(props.harness().turnTtlMinutes());
        if (t.getGeneration() == GenerationSide.CLIENT) {
            if (!w.isOpen() || !store.toReady(id, ttl)) {
                cancelIfOpen(id, w);
                return;
            }
            Map<String, Object> ev = new LinkedHashMap<>();
            ev.put("turnId", id);
            ev.put("messages", d.path("messages"));
            ev.put("params", d.path("params"));
            ev.put("outputSchema", d.path("outputSchema"));
            ev.put("modelProfile", d.path("modelProfile"));
            ev.put("clientGuard", d.path("clientGuard"));
            ev.put("attempt", (int) t.getAttempt());
            w.finish("prepared", ev);
            return;
        }
        if (!store.transition(id, TurnStatus.GENERATING, TurnStatus.PREPARING)) {
            cancelIfOpen(id, w);
            return;
        }
        w.send("status", Map.of("stage", "GENERATING"));
        generateLoop(t, p, d, h, w);
    }

    private void generateLoop(HarnessTurn t, ModelProvider p, JsonNode prepared, TurnRegistry.Handle h, SseWriter w) {
        UUID id = t.getId();
        ArrayNode msgs = (ArrayNode) prepared.path("messages").deepCopy();
        while (true) {
            ObjectNode g = json.createObjectNode().put("turnId", id.toString());
            ObjectNode target = g.putObject("target").put("kind", p.getKind().name()).put("model", p.getModel());
            if (p.getBaseUrl() != null) target.put("baseUrl", p.getBaseUrl());
            g.set("messages", msgs);
            g.set("params", prepared.path("params"));
            g.set("outputSchema", prepared.path("outputSchema"));
            g.set("modelProfile", prepared.path("modelProfile"));
            g.set("clientGuard", prepared.path("clientGuard"));

            StringBuilder buf = new StringBuilder();
            JsonNode done = null;
            for (AiEvent ev : ai.generate(g).takeUntilOther(h.cancel.asMono()).toIterable()) {
                JsonNode d = ev.data();
                switch (ev.name()) {
                    case "queued" -> w.send("status", Map.of("stage", "QUEUED",
                            "detail", String.valueOf(d.path("position").asInt())));
                    case "token" -> {
                        String text = d.path("text").asString("");
                        buf.append(text);
                        h.partialChars.set(buf.length());
                        w.send("token", Map.of("text", text));
                    }
                    case "done" -> done = d;
                    case "error" -> {
                        failOpen(id, w, d.path("code").asString("PROVIDER_ERROR"),
                                d.path("message").asString("The model failed to answer."),
                                d.path("retryable").asBoolean(true));
                        return;
                    }
                    default -> log.debug("ignoring generate event {}", ev.name());
                }
            }
            JsonNode output;
            if (done != null && !h.cancelRequested.get()) {
                output = done;
            } else if (h.cancelRequested.get()) {
                if (t.getTask() != Task.MESSAGE || buf.toString().isBlank()) {
                    cancelIfOpen(id, w);
                    return;
                }
                ObjectNode partial = json.createObjectNode().put("content", buf.toString())
                        .put("finishReason", "ABORTED");
                partial.putObject("stats").put("model", p.getModel());
                output = partial;
            } else {
                failOpen(id, w, "AI_SERVICE_UNAVAILABLE", "The model stream ended unexpectedly.", true);
                return;
            }

            TurnFinalizer.Outcome o = finalizer.finalizeAndApply(id, TurnStatus.GENERATING, output, w);
            switch (o) {
                case TurnFinalizer.Terminal(var result) -> {
                    if (result.status() == TurnStatus.CANCELLED) w.finish("cancelled", Map.of("turnId", id));
                    else w.finish("done", result);
                    return;
                }
                case TurnFinalizer.Retry r -> {
                    w.send("retry", Map.of("attempt", r.attempt(), "reason", r.reason()));
                    for (JsonNode m : r.repairMessages()) msgs.add(m);
                    h.partialChars.set(0);
                }
                case TurnFinalizer.Failed f -> {
                    w.finish("error", error(f.code(), f.message(), f.retryable()));
                    return;
                }
                case TurnFinalizer.Lost l -> {
                    return;
                }
            }
        }
    }

    private void cancelIfOpen(UUID id, SseWriter w) {
        if (store.transition(id, TurnStatus.CANCELLED, TurnStatus.PREPARING, TurnStatus.AWAITING_APPROVAL,
                TurnStatus.READY, TurnStatus.GENERATING)) {
            outcomes.onTerminal(id);
        }
        w.finish("cancelled", Map.of("turnId", id));
    }

    private void failOpen(UUID id, SseWriter w, String code, String message, boolean retryable) {
        if (store.fail(id, code, TurnStatus.PREPARING, TurnStatus.AWAITING_APPROVAL, TurnStatus.READY,
                TurnStatus.GENERATING, TurnStatus.FINALIZING)) {
            outcomes.onTerminal(id);
        }
        w.finish("error", error(code, message, retryable));
    }

    private static Map<String, Object> error(String code, String message, boolean retryable) {
        return Map.of("code", code, "message", message, "retryable", retryable);
    }

    private JsonNode publicSources(JsonNode items) {
        ArrayNode out = json.createArrayNode();
        for (JsonNode s : items) {
            ObjectNode c = (ObjectNode) s.deepCopy();
            c.remove(List.of("text", "chunkEmbeddingAvailable"));
            out.add(c);
        }
        return out;
    }
}
