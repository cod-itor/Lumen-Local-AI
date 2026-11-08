package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

/** A non-MESSAGE task (BACKEND.md §7.2 step 3, §7.5 TaskInputResolver, §7.6 handlers, §7.9 terminal effects). */
public interface TaskHandler {

    /** Where the turn points and which lock it takes. */
    record Target(String type, UUID id, UUID chatId, String lockKey) {}

    /** Thrown by {@link #apply} when the target changed meanwhile: the result is discarded, the turn CANCELLED. */
    final class Discard extends RuntimeException {
        public Discard(String why) {
            super(why, null, false, false);
        }
    }

    Task task();

    /** Validate the request, the target's ownership and state (synchronous, before the stream). */
    Target target(UUID userId, HarnessTurnRequest r);

    /** `taskInput` sent to the AI service's prepare. */
    ObjectNode taskInput(HarnessTurn t);

    /** Apply a valid finalize result inside the turn's transaction; returns `TurnResult.data`. */
    Object apply(HarnessTurn t, JsonNode finalizeResponse);

    /** Side effects when the turn ends FAILED, EXPIRED or CANCELLED (own transaction). */
    default void onTerminal(HarnessTurn t, TurnStatus status) {}
}
