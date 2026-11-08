package com.learnai.dto.response;

import com.learnai.entity.enums.ContentStatus;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.entity.enums.StepStatus;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** API_CONTRACT §4.9. */
public final class LearningDtos {

    private LearningDtos() {}

    public record LearningStepDto(UUID id, int position, String title, String summary, JsonNode objectives,
                                  String content, ContentStatus contentStatus, StepStatus status, Float bestScore) {}

    public record Progress(int done, int total) {}

    public record LearningPathDto(UUID id, String goal, LearningPathState state, String nextAction,
                                  JsonNode interview, JsonNode plan, List<LearningStepDto> steps, Progress progress,
                                  Instant createdAt, Instant updatedAt) {}

    public record QuizQuestionDto(int index, String question, List<String> options) {}

    public record QuizDto(UUID id, UUID stepId, List<QuizQuestionDto> questions, Instant createdAt) {}

    public record QuizItemResult(int index, Integer selected, int correctIndex, boolean correct, String explanation,
                                 String evidence) {}

    public record QuizResultDto(UUID quizId, double score, boolean passed, List<QuizItemResult> results,
                                LearningStepDto step, LearningStepDto nextStep) {}
}
