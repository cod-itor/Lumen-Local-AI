package com.learnai.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.Map;

public record CompleteTurnRequest(
        @NotNull String content,
        @NotNull @Pattern(regexp = "STOP|LENGTH|ABORTED|GUARD_STOP|LOOP_STOP") String finishReason,
        Map<String, Object> stats,
        @Min(1) int attempt) {}
