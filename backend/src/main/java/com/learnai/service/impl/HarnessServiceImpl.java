package com.learnai.service.impl;

import com.learnai.config.AppProperties;
import com.learnai.dto.request.CancelTurnRequest;
import com.learnai.dto.request.CompleteTurnRequest;
import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.dto.response.CancelTurnResponse;
import com.learnai.dto.response.TurnDto;
import com.learnai.dto.response.TurnResult;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.UserSettings;
import com.learnai.entity.enums.ProviderKind;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.exception.ApiException;
import com.learnai.harness.SseWriter;
import com.learnai.harness.TurnContext;
import com.learnai.harness.TurnFinalizer;
import com.learnai.harness.TurnOutcomeService;
import com.learnai.harness.TurnRegistry;
import com.learnai.harness.TurnRunner;
import com.learnai.harness.TurnStore;
import com.learnai.harness.task.TaskHandler;
import com.learnai.harness.task.TaskHandlers;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.ModelProviderRepository;
import com.learnai.service.HarnessService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

@Service
@RequiredArgsConstructor
public class HarnessServiceImpl implements HarnessService {

    private static final long STREAM_TIMEOUT_MS = Duration.ofMinutes(15).toMillis();

    private final ModelProviderRepository providers;
    private final HarnessTurnRepository turns;
    private final TurnStore store;
    private final TurnRunner runner;
    private final TurnFinalizer finalizer;
    private final TurnRegistry registry;
    private final TurnOutcomeService outcomes;
    private final TurnContext ctx;
    private final AppProperties props;
    private final ObjectMapper json;
    private final ExecutorService turnExecutor;
    private final ScheduledExecutorService sseHeartbeat;
    private final TaskHandlers handlers;

    @Override
    public SseEmitter startTurn(UUID userId, HarnessTurnRequest r) {
        TaskHandler handler = r.task() == Task.MESSAGE ? null : handlers.get(r.task()).orElseThrow(() ->
                new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE",
                        "This task is not available yet."));
        ModelProvider p = providers.findByIdAndUserId(r.providerId(), userId)
                .orElseThrow(() -> ApiException.notFound("provider"));
        if (p.getKind() == ProviderKind.REMOTE_URL && !props.harness().remoteUrlEnabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE",
                    "Remote model endpoints are turned off on this server.");
        }
        UserSettings s = ctx.settings(userId);
        String outLang = r.outputLanguage() != null ? r.outputLanguage().name() : s.getOutputLanguage().name();
        TurnStore.Created created = handler == null ? store.createMessageTurn(userId, r, p, ttl(), outLang)
                : store.createTaskTurn(userId, r, p, ttl(), handler.target(userId, r));

        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);
        SseWriter writer = new SseWriter(emitter, json, sseHeartbeat);
        TurnRegistry.Handle h = registry.register(created.turnId(), writer);
        writer.onDisconnect(h::requestCancel);
        turnExecutor.submit(() -> runner.run(created.turnId(), h));
        return emitter;
    }

    @Override
    public TurnResult complete(UUID userId, UUID turnId, CompleteTurnRequest r) {
        HarnessTurn t = turns.findByIdAndUserId(turnId, userId).orElseThrow(this::turnNotFound);
        if (t.getStatus() == TurnStatus.EXPIRED
                || (t.getStatus() == TurnStatus.READY && t.getExpiresAt().isBefore(Instant.now()))) {
            if (store.transition(turnId, TurnStatus.EXPIRED, TurnStatus.READY)) outcomes.onTerminal(turnId);
            throw new ApiException(HttpStatus.GONE, "TURN_EXPIRED", "This request expired. Please try again.");
        }
        if (t.getStatus().isTerminal()) throw alreadyCompleted();
        if (t.getStatus() != TurnStatus.READY || t.getAttempt() != r.attempt()) {
            throw new ApiException(HttpStatus.CONFLICT, "TURN_NOT_READY", "This request is not waiting for an answer.");
        }
        if (r.content().getBytes(StandardCharsets.UTF_8).length > props.harness().maxCompletionKb() * 1024) {
            throw new ApiException(HttpStatus.CONTENT_TOO_LARGE, "PAYLOAD_TOO_LARGE", "The answer is too long.");
        }
        if ("ABORTED".equals(r.finishReason()) && t.getTask() != Task.MESSAGE) {
            if (store.transition(turnId, TurnStatus.CANCELLED, TurnStatus.READY)) outcomes.onTerminal(turnId);
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "Stopped. Nothing was saved.");
        }
        ObjectNode output = json.createObjectNode().put("content", r.content()).put("finishReason", r.finishReason());
        output.set("stats", r.stats() == null ? json.createObjectNode() : json.valueToTree(r.stats()));
        TurnFinalizer.Outcome o = finalizer.finalizeAndApply(turnId, TurnStatus.READY, output, null);
        return switch (o) {
            case TurnFinalizer.Terminal(var result) -> result;
            case TurnFinalizer.Retry rt -> {
                Map<String, Object> details = new LinkedHashMap<>();
                details.put("reason", rt.reason());
                details.put("errors", rt.errors());
                details.put("attemptsLeft", rt.attemptsLeft());
                details.put("repairMessages", rt.repairMessages());
                throw new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, "SCHEMA_INVALID",
                        "The model returned an invalid answer. Retrying…", details);
            }
            case TurnFinalizer.Failed f -> throw new ApiException(statusFor(f.code()), f.code(), f.message());
            case TurnFinalizer.Lost l -> throw new ApiException(HttpStatus.CONFLICT, "TURN_NOT_READY",
                    "This request is not waiting for an answer.");
        };
    }

    @Override
    public CancelTurnResponse cancel(UUID userId, UUID turnId, CancelTurnRequest r) {
        HarnessTurn t = turns.findByIdAndUserId(turnId, userId).orElseThrow(this::turnNotFound);
        String reason = r == null || r.reason() == null ? "USER" : r.reason();
        if (t.getStatus().isTerminal()) throw alreadyCompleted();
        if (t.getStatus() == TurnStatus.FINALIZING) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "The answer is being saved.");
        }
        if ("CLIENT_ERROR".equals(reason)) {
            String code = r.errorCode() == null || r.errorCode().isBlank() ? "PROVIDER_ERROR" : r.errorCode();
            if (!store.fail(turnId, code, TurnStatus.READY)) {
                throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This request is not waiting for an answer.");
            }
            outcomes.onTerminal(turnId);
            return new CancelTurnResponse(turnId, TurnStatus.FAILED);
        }
        if (t.getStatus() == TurnStatus.GENERATING) {
            var h = registry.get(turnId);
            if (h.isPresent()) {
                boolean partial = t.getTask() == Task.MESSAGE && h.get().partialChars.get() > 0;
                h.get().requestCancel();
                return new CancelTurnResponse(turnId, partial ? TurnStatus.FINALIZING : TurnStatus.CANCELLED);
            }
        }
        if (!store.transition(turnId, TurnStatus.CANCELLED, TurnStatus.PREPARING, TurnStatus.AWAITING_APPROVAL,
                TurnStatus.READY, TurnStatus.GENERATING)) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This request already finished.");
        }
        outcomes.onTerminal(turnId);
        registry.get(turnId).ifPresent(h -> {
            h.requestCancel();
            if (h.writer != null) h.writer.finish("cancelled", Map.of("turnId", turnId));
        });
        return new CancelTurnResponse(turnId, TurnStatus.CANCELLED);
    }

    @Override
    public TurnDto getTurn(UUID userId, UUID turnId) {
        HarnessTurn t = turns.findByIdAndUserId(turnId, userId).orElseThrow(this::turnNotFound);
        return new TurnDto(t.getId(), t.getTask(), t.getStatus(), t.getGeneration(), t.getAttempt(), t.getErrorCode(),
                t.getCreatedAt(), t.getExpiresAt(), t.getResultMessageId());
    }

    private Duration ttl() {
        return Duration.ofMinutes(props.harness().turnTtlMinutes());
    }

    private ApiException turnNotFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "TURN_NOT_FOUND", "Request not found.");
    }

    private static ApiException alreadyCompleted() {
        return new ApiException(HttpStatus.CONFLICT, "TURN_ALREADY_COMPLETED", "This request already finished.");
    }

    private static HttpStatus statusFor(String code) {
        return switch (code) {
            case "AI_SERVICE_UNAVAILABLE" -> HttpStatus.SERVICE_UNAVAILABLE;
            case "AI_TIMEOUT" -> HttpStatus.GATEWAY_TIMEOUT;
            default -> HttpStatus.INTERNAL_SERVER_ERROR;
        };
    }
}
