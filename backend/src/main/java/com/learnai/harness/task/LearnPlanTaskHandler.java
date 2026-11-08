package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.LearningPath;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.entity.enums.Task;
import com.learnai.repository.LearningPathRepository;
import com.learnai.service.learning.LearningMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

/** LEARN_PLAN (BACKEND.md §7.6): plan = data, state AWAITING_APPROVAL. */
@Component
@RequiredArgsConstructor
public class LearnPlanTaskHandler implements TaskHandler {

    private final LearningTargets targets;
    private final LearningPathRepository paths;
    private final LearningMapper mapper;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.LEARN_PLAN;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        LearningPath p = targets.path(userId, r, LearningPathState.PLANNING);
        return new Target("LEARNING_PATH", p.getId(), null, LearningTargets.lock(p.getId()));
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        LearningPath p = paths.findById(t.getTargetId()).orElseThrow();
        ObjectNode ti = json.createObjectNode().put("goal", p.getGoal());
        ObjectNode answers = ti.putObject("answers");
        for (JsonNode it : p.getInterview()) {
            if (it.path("answer").isString()) answers.put(it.path("topic").asString(), it.path("answer").asString());
        }
        return ti;
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        LearningPath p = paths.findForUpdate(t.getTargetId()).orElseThrow(() -> new Discard("path deleted"));
        if (p.getState() != LearningPathState.PLANNING) throw new Discard("path changed");
        p.setPlan(r.path("data").deepCopy());
        p.setState(LearningPathState.AWAITING_APPROVAL);
        return mapper.path(paths.save(p));
    }
}
