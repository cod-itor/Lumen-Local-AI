package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.LearningPath;
import com.learnai.entity.LearningStep;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.exception.ApiException;
import com.learnai.repository.LearningPathRepository;
import com.learnai.repository.LearningStepRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/** Shared target checks of the learning tasks (API_CONTRACT §6.4 per-task rules). Lock: path:{pathId}. */
@Component
@RequiredArgsConstructor
public class LearningTargets {

    private final LearningPathRepository paths;
    private final LearningStepRepository steps;

    public LearningPath path(UUID userId, HarnessTurnRequest r, LearningPathState expected) {
        if (r.target() == null || !"LEARNING_PATH".equals(r.target().type())) {
            throw ApiException.validation("target", "This task needs target { type: LEARNING_PATH, id }.");
        }
        LearningPath p = paths.findByIdAndUserId(r.target().id(), userId)
                .orElseThrow(() -> ApiException.notFound("learning path"));
        if (p.getState() != expected) throw conflict(p);
        return p;
    }

    public LearningStep step(UUID userId, HarnessTurnRequest r) {
        if (r.target() == null || !"LEARNING_STEP".equals(r.target().type())) {
            throw ApiException.validation("target", "This task needs target { type: LEARNING_STEP, id }.");
        }
        LearningStep s = steps.findById(r.target().id()).orElseThrow(() -> ApiException.notFound("learning step"));
        LearningPath p = paths.findByIdAndUserId(s.getPathId(), userId)
                .orElseThrow(() -> ApiException.notFound("learning step"));
        if (p.getState() != LearningPathState.ACTIVE && p.getState() != LearningPathState.COMPLETED) throw conflict(p);
        return s;
    }

    public static String lock(UUID pathId) {
        return "path:" + pathId;
    }

    static ApiException conflict(LearningPath p) {
        return new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This learning path is not ready for that.",
                Map.of("currentState", p.getState().name()));
    }
}
