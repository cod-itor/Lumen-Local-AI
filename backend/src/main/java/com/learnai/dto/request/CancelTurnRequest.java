package com.learnai.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CancelTurnRequest(@Pattern(regexp = "USER|CLIENT_ERROR") String reason, @Size(max = 40) String errorCode) {}
