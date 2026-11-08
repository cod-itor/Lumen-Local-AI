package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.LearningStep;
import com.learnai.entity.Quiz;
import com.learnai.entity.enums.ContentStatus;
import com.learnai.entity.enums.Task;
import com.learnai.exception.ApiException;
import com.learnai.repository.LearningPathRepository;
import com.learnai.repository.LearningStepRepository;
import com.learnai.repository.QuizRepository;
import com.learnai.service.learning.LearningMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.UUID;

/** QUIZ (BACKEND.md §7.6): questions with answers stored; the client gets them without answers. */
@Component
@RequiredArgsConstructor
public class QuizTaskHandler implements TaskHandler {

    private final LearningTargets targets;
    private final LearningPathRepository paths;
    private final LearningStepRepository steps;
    private final QuizRepository quizzes;
    private final LearningMapper mapper;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.QUIZ;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        LearningStep s = targets.step(userId, r);
        if (s.getContentStatus() != ContentStatus.READY) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "Open the lesson first.");
        }
        Object c = r.taskInput() == null ? null : r.taskInput().get("count");
        if (c != null && !(c instanceof Number n && n.intValue() >= 3 && n.intValue() <= 5)) {
            throw ApiException.validation("taskInput.count", "count must be 3, 4 or 5.");
        }
        return new Target("LEARNING_STEP", s.getId(), null, LearningTargets.lock(s.getPathId()));
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        LearningStep s = steps.findById(t.getTargetId()).orElseThrow();
        int count = t.getRequest().path("taskInput").path("count").asInt(5);
        return json.createObjectNode().put("lesson", s.getContent() == null ? "" : s.getContent()).put("count", count);
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        LearningStep s = steps.findById(t.getTargetId()).orElseThrow(() -> new Discard("step deleted"));
        paths.findForUpdate(s.getPathId()).orElseThrow(() -> new Discard("path deleted"));
        s = steps.findById(t.getTargetId()).orElseThrow(() -> new Discard("step deleted"));
        if (s.getContentStatus() != ContentStatus.READY) throw new Discard("lesson gone");
        JsonNode qs = r.path("data").path("questions");
        if (!qs.isArray() || qs.isEmpty()) throw new IllegalStateException("finalize returned no questions");
        Quiz q = quizzes.saveAndFlush(Quiz.builder().userId(t.getUserId()).stepId(s.getId()).questions(qs.deepCopy()).build());
        return mapper.quiz(q);
    }
}
