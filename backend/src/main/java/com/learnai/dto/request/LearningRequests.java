package com.learnai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import tools.jackson.databind.JsonNode;

import java.util.List;

/** API_CONTRACT §6.9 request bodies. */
public final class LearningRequests {

    private LearningRequests() {}

    public record CreatePath(@NotBlank @Size(min = 3, max = 200) String goal) {}

    public record Answer(@NotBlank @Size(min = 1, max = 300) String answer) {}

    public record PutPlan(@NotNull JsonNode plan) {}

    public record SubmitQuiz(@NotNull @Size(max = 10) List<Integer> answers) {}
}
