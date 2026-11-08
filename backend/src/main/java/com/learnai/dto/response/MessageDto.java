package com.learnai.dto.response;

import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.MessageStatus;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record MessageDto(UUID id, UUID chatId, UUID parentId, MessageRole role, String content,
                         String originalContent, JsonNode translations, MessageStatus status, JsonNode meta,
                         Instant createdAt) {}
