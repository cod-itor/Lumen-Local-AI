package com.learnai.service;

import com.learnai.dto.response.ProviderDto;
import com.learnai.entity.ModelProvider;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

public interface ProviderService {
    List<ProviderDto> list(UUID userId);

    JsonNode catalog();

    ProviderDto setDefault(UUID userId, UUID providerId);

    ProviderDto create(UUID userId, com.learnai.dto.request.CreateProviderRequest r);

    ProviderDto update(UUID userId, UUID providerId, com.learnai.dto.request.UpdateProviderRequest r);

    void delete(UUID userId, UUID providerId);

    ProviderDto testResult(UUID userId, UUID providerId, com.learnai.dto.request.ProviderTestResultRequest r);

    ProviderDto test(UUID userId, UUID providerId);

    UUID defaultProviderId(UUID userId);

    /** The provider with a profile resolved against the current rules (BACKEND.md §9.5). */
    ModelProvider loadFresh(UUID userId, UUID providerId);

    ProviderDto toDto(ModelProvider p);
}
