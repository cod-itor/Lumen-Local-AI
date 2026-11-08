package com.learnai.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.ProviderKind;
import com.learnai.entity.enums.ProviderStatus;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

public record ProviderDto(UUID id, String name, ProviderKind kind, GenerationSide generation, String baseUrl,
                          String model, boolean hasApiKey, @JsonProperty("isDefault") boolean isDefault,
                          ProviderStatus status, Instant lastTestedAt, String lastTestMessage, JsonNode modelProfile,
                          Features features, Instant createdAt) {

    public record Features(boolean chat, boolean documents, boolean webSearch, boolean learning, boolean images) {}
}
