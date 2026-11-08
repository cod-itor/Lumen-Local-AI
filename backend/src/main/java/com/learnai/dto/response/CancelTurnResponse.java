package com.learnai.dto.response;

import com.learnai.entity.enums.TurnStatus;

import java.util.UUID;

public record CancelTurnResponse(UUID turnId, TurnStatus status) {}
