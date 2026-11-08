package com.learnai.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Create or rename a project. */
public record ProjectRequest(@NotBlank @Size(max = 60) String name) {}
