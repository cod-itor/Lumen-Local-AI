package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.LearningPath;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.entity.enums.Task;
import com.learnai.repository.LearningPathRepository;
import com.learnai.service.learning.LearningMapper;
import com.learnai.service.learning.LearningRules;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

/** LEARN_QUESTION (BACKEND.md §7.6): next interview question, or `done` → PLANNING. */
@Component
@RequiredArgsConstructor
public class LearnQuestionTaskHandler implements TaskHandler {

    private final LearningTargets targets;
    private final LearningPathRepository paths;
    private final LearningMapper mapper;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.LEARN_QUESTION;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        LearningPath p = targets.path(userId, r, LearningPathState.INTERVIEWING);
        if (LearningRules.hasPending(p)) throw LearningTargets.conflict(p);
        return new Target("LEARNING_PATH", p.getId(), null, LearningTargets.lock(p.getId()));
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        LearningPath p = paths.findById(t.getTargetId()).orElseThrow();
        ObjectNode ti = json.createObjectNode().put("goal", p.getGoal());
        ObjectNode answered = ti.putObject("answered");
        ArrayNode asked = ti.putArray("askedTopics");
        for (JsonNode it : p.getInterview()) {
            asked.add(it.path("topic").asString());
            if (it.path("answer").isString()) answered.put(it.path("topic").asString(), it.path("answer").asString());
        }
        return ti;
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        LearningPath p = paths.findForUpdate(t.getTargetId()).orElseThrow(() -> new Discard("path deleted"));
        if (p.getState() != LearningPathState.INTERVIEWING || LearningRules.hasPending(p)) {
            throw new Discard("path changed");
        }
        JsonNode d = r.path("data");
        if (d.path("done").asBoolean(false) || p.getInterview().size() >= LearningRules.MAX_QUESTIONS) {
            p.setState(LearningPathState.PLANNING);
        } else {
            ArrayNode iv = (ArrayNode) p.getInterview().deepCopy();
            ObjectNode item = iv.addObject().put("topic", d.path("topic").asString("focus"))
                    .put("question", d.path("question").asString(""));
            ArrayNode opts = item.putArray("options");
            for (JsonNode o : d.path("options")) opts.add(o.asString());
            item.putNull("answer");
            p.setInterview(iv);
        }
        return mapper.path(paths.save(p));
    }
}
