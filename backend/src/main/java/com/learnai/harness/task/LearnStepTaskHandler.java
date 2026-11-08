package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.LearningPath;
import com.learnai.entity.LearningStep;
import com.learnai.entity.enums.ContentStatus;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.entity.enums.StepStatus;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.exception.ApiException;
import com.learnai.repository.LearningPathRepository;
import com.learnai.repository.LearningStepRepository;
import com.learnai.service.learning.LearningMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;
import java.util.UUID;

/** LEARN_STEP (BACKEND.md §7.6): the lesson text of one step (English). */
@Component
@RequiredArgsConstructor
public class LearnStepTaskHandler implements TaskHandler {

    private final LearningTargets targets;
    private final LearningPathRepository paths;
    private final LearningStepRepository steps;
    private final LearningMapper mapper;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.LEARN_STEP;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        LearningStep s = targets.step(userId, r);
        if (s.getStatus() == StepStatus.LOCKED) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "Finish the earlier steps first.");
        }
        if (s.getContentStatus() == ContentStatus.READY) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This lesson is already written.");
        }
        return new Target("LEARNING_STEP", s.getId(), null, LearningTargets.lock(s.getPathId()));
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        LearningStep s = steps.findById(t.getTargetId()).orElseThrow();
        LearningPath p = paths.findById(s.getPathId()).orElseThrow();
        List<LearningStep> all = steps.findByPathIdOrderByPosition(p.getId());
        JsonNode plan = p.getPlan() == null ? json.createObjectNode() : p.getPlan();
        ObjectNode ti = json.createObjectNode().put("planTitle", plan.path("title").asString(p.getGoal()))
                .put("level", plan.path("level").asString("BEGINNER")).put("stepNumber", (int) s.getPosition())
                .put("totalSteps", all.size()).put("title", s.getTitle()).put("summary", s.getSummary());
        ti.set("objectives", s.getObjectives());
        ArrayNode prev = ti.putArray("previousTitles");
        all.stream().filter(x -> x.getPosition() < s.getPosition()).forEach(x -> prev.add(x.getTitle()));
        return ti;
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        LearningStep s = steps.findById(t.getTargetId()).orElseThrow(() -> new Discard("step deleted"));
        LearningPath p = paths.findForUpdate(s.getPathId()).orElseThrow(() -> new Discard("path deleted"));
        if (p.getState() != LearningPathState.ACTIVE && p.getState() != LearningPathState.COMPLETED) {
            throw new Discard("path not active");
        }
        s = steps.findById(t.getTargetId()).orElseThrow(() -> new Discard("step deleted"));
        String text = r.path("originalContent").isString() ? r.path("originalContent").asString()
                : r.path("content").asString("");
        s.setContent(text);
        s.setContentStatus(ContentStatus.READY);
        return mapper.step(steps.save(s));
    }

    @Override
    public void onTerminal(HarnessTurn t, TurnStatus status) {
        if (status != TurnStatus.FAILED) return;
        steps.findById(t.getTargetId()).filter(s -> s.getContentStatus() == ContentStatus.EMPTY).ifPresent(s -> {
            s.setContentStatus(ContentStatus.FAILED);
            steps.save(s);
        });
    }
}
