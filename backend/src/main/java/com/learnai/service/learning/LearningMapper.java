package com.learnai.service.learning;

import com.learnai.dto.response.LearningDtos.LearningPathDto;
import com.learnai.dto.response.LearningDtos.LearningStepDto;
import com.learnai.dto.response.LearningDtos.Progress;
import com.learnai.dto.response.LearningDtos.QuizDto;
import com.learnai.dto.response.LearningDtos.QuizQuestionDto;
import com.learnai.entity.LearningPath;
import com.learnai.entity.LearningStep;
import com.learnai.entity.Quiz;
import com.learnai.entity.enums.StepStatus;
import com.learnai.repository.LearningStepRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class LearningMapper {

    private final LearningStepRepository steps;

    public LearningPathDto path(LearningPath p) {
        return path(p, steps.findByPathIdOrderByPosition(p.getId()));
    }

    public LearningPathDto path(LearningPath p, List<LearningStep> list) {
        List<LearningStepDto> dtos = list.stream().map(this::step).toList();
        int done = (int) list.stream().filter(s -> s.getStatus() == StepStatus.DONE).count();
        return new LearningPathDto(p.getId(), p.getGoal(), p.getState(), LearningRules.nextAction(p), p.getInterview(),
                p.getPlan(), dtos, new Progress(done, list.size()), p.getCreatedAt(), p.getUpdatedAt());
    }

    public LearningStepDto step(LearningStep s) {
        return s == null ? null : new LearningStepDto(s.getId(), s.getPosition(), s.getTitle(), s.getSummary(),
                s.getObjectives(), s.getContent(), s.getContentStatus(), s.getStatus(), s.getBestScore());
    }

    /** Never includes answerIndex, evidence or explanation. */
    public QuizDto quiz(Quiz q) {
        List<QuizQuestionDto> out = new ArrayList<>();
        int i = 0;
        for (JsonNode item : q.getQuestions()) {
            List<String> options = new ArrayList<>();
            for (JsonNode o : item.path("options")) options.add(o.asString());
            out.add(new QuizQuestionDto(i++, item.path("question").asString(""), options));
        }
        return new QuizDto(q.getId(), q.getStepId(), out, q.getCreatedAt());
    }
}
