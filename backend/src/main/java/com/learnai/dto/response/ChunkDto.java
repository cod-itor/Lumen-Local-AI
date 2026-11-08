package com.learnai.dto.response;

import java.util.UUID;

public record ChunkDto(UUID chunkId, UUID documentId, Integer page, int startChar, int endChar, String text) {}
