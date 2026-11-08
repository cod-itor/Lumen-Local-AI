package com.learnai.dto.response;

import com.learnai.entity.enums.ImageKind;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** API_CONTRACT §4.8. */
public final class ImageDtos {

    private ImageDtos() {}

    public record ImageSessionDto(UUID id, String title, UUID coverImageId, Instant createdAt, Instant updatedAt) {}

    public record ImageDto(UUID id, UUID sessionId, UUID parentId, ImageKind kind, String prompt, String originalPrompt,
                           String url, int width, int height, JsonNode meta, Instant createdAt) {}

    public record JobStarted(UUID jobId) {}
}
