package com.learnai.dto.response;

import java.time.Instant;
import java.util.UUID;

public record ProjectDto(UUID id, String name, long chatCount, Instant createdAt, Instant updatedAt) {}
