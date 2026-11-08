package com.learnai.harness;

import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.config.AppProperties;
import com.learnai.dto.response.MessageDto;
import com.learnai.dto.response.TurnResult;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.MessageStatus;
import com.learnai.entity.enums.Task;
import com.learnai.harness.task.TaskHandler;
import com.learnai.harness.task.TaskHandlers;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.ModelProviderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** finalizeAndApply (BACKEND.md §7.4), shared by SERVER `done` and CLIENT `complete`. */
@Slf4j
@Component
@RequiredArgsConstructor
public class TurnFinalizer {

    public static final String FAILED_NOTICE =
            "This model couldn't produce a valid result. Try again or choose another model.";

    public sealed interface Outcome permits Terminal, Retry, Failed, Lost {}

    /** A final TurnResult (COMPLETED, BLOCKED, ABSTAINED, CANCELLED or FAILED). */
    public record Terminal(TurnResult result) implements Outcome {}

    public record Retry(int attempt, String reason, JsonNode errors, int attemptsLeft, JsonNode repairMessages)
            implements Outcome {}

    /** The output pipeline itself failed (the turn is FAILED with this code). */
    public record Failed(String code, String message, boolean retryable) implements Outcome {}

    /** Another path (cancel, housekeeping) changed the turn first: do nothing. */
    public record Lost() implements Outcome {}

    private final TurnStore store;
    private final HarnessTurnRepository turns;
    private final ModelProviderRepository providers;
    private final AiServiceClient ai;
    private final TurnContext ctx;
    private final TurnOutcomeService outcomes;
    private final AppProperties props;
    private final ObjectMapper json;
    private final TaskHandlers handlers;

    public Outcome finalizeAndApply(UUID turnId, TurnStatus from, JsonNode output, SseWriter writer) {
        if (!store.transition(turnId, TurnStatus.FINALIZING, from)) return new Lost();
        if (writer != null) writer.send("status", Map.of("stage", "CHECKING_OUTPUT"));
        HarnessTurn t = turns.findById(turnId).orElseThrow();
        String finish = output.path("finishReason").asString("STOP");
        JsonNode resp;
        try {
            ModelProvider p = providers.findById(t.getProviderId()).orElse(null);
            ObjectNode req = json.createObjectNode().put("turnId", turnId.toString()).put("task", t.getTask().name())
                    .put("attempt", (int) t.getAttempt());
            req.set("user", ctx.user(t));
            req.set("provider", p == null ? json.createObjectNode().put("kind", t.getProviderKind().name())
                    .put("model", t.getModel()) : ctx.provider(p));
            req.set("context", t.getPrepareContext());
            var handler = handlers.get(t.getTask());
            if (handler.isPresent()) req.set("taskInput", handler.get().taskInput(t));
            else req.putNull("taskInput");
            req.set("output", output);
            resp = ai.finalizeTurn(req);
        } catch (AiServiceException e) {
            return fail(turnId, e.getCode(), e.getMessage(), e.isRetryable());
        } catch (RuntimeException e) {
            log.error("finalize failed for turn {}", turnId, e);
            return fail(turnId, "INTERNAL_ERROR", "Something went wrong while saving the answer.", true);
        }

        outcomes.saveGuardEvents(turnId, resp.path("guardEvents"));
        try {
            Outcome o = apply(t, resp, output, finish);
            if (o instanceof Terminal) outcomes.writeMetrics(turnId, resp.path("metrics"), output.path("stats"), finish);
            return o;
        } catch (RuntimeException e) {
            log.error("applying the result failed for turn {}", turnId, e);
            return fail(turnId, "INTERNAL_ERROR", "Something went wrong while saving the answer.", true);
        }
    }

    private Outcome apply(HarnessTurn t, JsonNode resp, JsonNode output, String finish) {
        UUID id = t.getId();
        String status = resp.path("status").asString("COMPLETED");
        int attempt = t.getAttempt();
        if ("EMPTY".equals(status) && "ABORTED".equals(finish)) {
            if (!store.transition(id, TurnStatus.CANCELLED, TurnStatus.FINALIZING)) return new Lost();
            outcomes.onTerminal(id);
            return new Terminal(result(t, TurnStatus.CANCELLED, null, null, null));
        }
        if ("EMPTY".equals(status) || "SCHEMA_INVALID".equals(status)) {
            int left = resp.path("attemptsLeft").asInt(0);
            String reason = "EMPTY".equals(status) ? "EMPTY" : "INVALID";
            if (left > 0) {
                Duration ttl = Duration.ofMinutes(props.harness().turnTtlMinutes());
                if (!store.retry(id, attempt + 1, t.getGeneration(), ttl)) return new Lost();
                return new Retry(attempt + 1, reason, resp.path("errors"), left, resp.path("repairMessages"));
            }
            String code = "EMPTY".equals(status) ? "EMPTY_OUTPUT" : "SCHEMA_INVALID";
            if (!store.fail(id, code, TurnStatus.FINALIZING)) return new Lost();
            outcomes.onTerminal(id);
            return new Terminal(result(t, TurnStatus.FAILED, null, FAILED_NOTICE, null));
        }
        if (t.getTask() != Task.MESSAGE) return applyTask(t, resp, status);
        MessageStatus ms;
        TurnStatus ts;
        String guardAction = null;
        switch (status) {
            case "BLOCKED" -> {
                ms = MessageStatus.BLOCKED;
                ts = TurnStatus.BLOCKED;
                guardAction = "REPLACE";
            }
            case "SUPPORT" -> {
                ms = MessageStatus.COMPLETE;
                ts = TurnStatus.BLOCKED;
                guardAction = "SUPPORT";
            }
            case "ABSTAINED" -> {
                ms = MessageStatus.ABSTAINED;
                ts = TurnStatus.ABSTAINED;
            }
            default -> {
                ms = "ABORTED".equals(finish) ? MessageStatus.STOPPED : MessageStatus.COMPLETE;
                ts = TurnStatus.COMPLETED;
            }
        }
        JsonNode guard = guardSummary(resp.path("guard"));
        MessageDto msg = store.applyMessage(id, List.of(TurnStatus.FINALIZING), ts, new TurnStore.MessageResult(
                resp.path("content").asString(""), resp.path("originalContent").asString(null),
                resp.path("translations"), ms, guard, resp.path("grounding"), resp.path("suggestions"),
                output.path("stats"), resp.path("finishReason").asString(finish)), null);
        if (msg == null) return new Lost();
        return new Terminal(result(t, ts, msg, null, guardAction));
    }

    private Outcome applyTask(HarnessTurn t, JsonNode resp, String status) {
        UUID id = t.getId();
        if ("BLOCKED".equals(status) || "SUPPORT".equals(status)) {
            if (!store.transition(id, TurnStatus.BLOCKED, TurnStatus.FINALIZING)) return new Lost();
            return new Terminal(result(t, TurnStatus.BLOCKED, null, resp.path("content").asString(""),
                    "SUPPORT".equals(status) ? "SUPPORT" : "REPLACE"));
        }
        TaskHandler handler = handlers.get(t.getTask()).orElseThrow();
        java.util.Optional<Object> data;
        try {
            data = store.applyTask(id, handler, resp);
        } catch (TaskHandler.Discard d) {
            log.info("turn {} result discarded: {}", id, d.getMessage());
            if (store.transition(id, TurnStatus.CANCELLED, TurnStatus.FINALIZING)) outcomes.onTerminal(id);
            return new Terminal(result(t, TurnStatus.CANCELLED, null, null, null));
        }
        if (data == null) return new Lost();
        return new Terminal(new TurnResult(id, t.getTask(), TurnStatus.COMPLETED, null, data.orElse(null), null,
                null));
    }

    private JsonNode guardSummary(JsonNode g) {
        ObjectNode o = json.createObjectNode().put("action", g.path("action").asString("ALLOW"));
        o.set("categories", g.path("categories").isArray() ? g.get("categories") : json.createArrayNode());
        o.put("profile", g.path("profile").asString("STANDARD"));
        return o;
    }

    private Outcome fail(UUID id, String code, String message, boolean retryable) {
        if (store.fail(id, code, TurnStatus.FINALIZING)) outcomes.onTerminal(id);
        return new Failed(code, message, retryable);
    }

    static TurnResult result(HarnessTurn t, TurnStatus status, MessageDto msg, String notice, String guardAction) {
        return new TurnResult(t.getId(), t.getTask(), status, msg, null, notice, guardAction);
    }

    static boolean isServer(HarnessTurn t) {
        return t.getGeneration() == GenerationSide.SERVER;
    }
}
