package com.learnai.dto.response;

import com.learnai.entity.enums.DocumentStatus;

import java.time.Instant;
import java.util.UUID;

public record DocumentDto(UUID id, String filename, String mime, long sizeBytes, Integer pages, DocumentStatus status,
                          String error, int chunkCount, String language, Instant createdAt) {}
