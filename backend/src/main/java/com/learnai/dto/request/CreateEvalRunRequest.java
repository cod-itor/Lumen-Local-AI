package com.learnai.dto.request;

import com.learnai.entity.enums.EvalMode;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record CreateEvalRunRequest(@NotNull UUID providerId, @NotNull @Pattern(regexp = "[a-z0-9_-]{1,40}") String suite,
                                   @NotNull EvalMode mode) {}
