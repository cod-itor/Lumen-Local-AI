package com.learnai.dto.response;

import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;

import java.time.Instant;
import java.util.UUID;

public record TurnDto(UUID id, Task task, TurnStatus status, GenerationSide generation, int attempt, String errorCode,
                      Instant createdAt, Instant expiresAt, UUID resultMessageId) {}
