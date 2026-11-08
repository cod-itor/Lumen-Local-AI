package com.learnai.dto.response;

import com.learnai.entity.enums.JobStatus;
import com.learnai.entity.enums.JobType;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record JobDto(UUID id, JobType type, JobStatus status, float progress, String stage, JsonNode result,
                     String error, Instant createdAt, Instant updatedAt) {}
