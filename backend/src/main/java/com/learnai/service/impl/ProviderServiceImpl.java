package com.learnai.service.impl;

import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.dto.response.ProviderDto;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.ProviderKind;
import com.learnai.entity.enums.ProviderKindSide;
import com.learnai.exception.ApiException;
import com.learnai.repository.ModelProviderRepository;
import com.learnai.service.ProviderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class ProviderServiceImpl implements ProviderService {

    private final ModelProviderRepository providers;
    private final AiServiceClient ai;
    private final ObjectMapper json;
    private final TransactionTemplate tx;
    private volatile JsonNode catalogCache;
    private volatile Instant catalogAt = Instant.EPOCH;

    @Override
    public List<ProviderDto> list(UUID userId) {
        ensureHost(userId);
        tx.executeWithoutResult(s -> {
            List<ModelProvider> all = providers.findByUserIdOrderByCreatedAtAsc(userId);
            if (!all.isEmpty() && all.stream().noneMatch(ModelProvider::isDefaultProvider)) {
                all.getFirst().setDefaultProvider(true);
            }
        });
        return providers.findByUserIdOrderByCreatedAtAsc(userId).stream().map(this::toDto).toList();
    }

    private void ensureHost(UUID userId) {
        if (providers.findByUserIdAndKind(userId, ProviderKind.HOST).isPresent()) return;
        JsonNode caps;
        try {
            caps = ai.capabilities();
        } catch (AiServiceException e) {
            return; // AI service down: no host provider for now
        }
        if (!caps.path("features").path("hostChat").asBoolean(false) || caps.path("hostChatModels").isEmpty()) return;
        String model = caps.path("defaultChatModel").asString(caps.path("hostChatModels").get(0).asString());
        JsonNode profile = ai.profile("HOST", model, null);
        try {
            tx.executeWithoutResult(s -> providers.saveAndFlush(ModelProvider.builder()
                    .userId(userId).name("Host model").kind(ProviderKind.HOST).model(model)
                    .modelProfile(profile).profileOverrides(json.createObjectNode())
                    .profileRulesVersion(caps.path("rulesVersion").asString(null))
                    .defaultProvider(providers.findByUserIdAndDefaultProviderTrue(userId).isEmpty())
                    .build()));
        } catch (DataIntegrityViolationException e) {
            log.debug("Host provider created concurrently for {}", userId);
        }
    }

    @Override
    public JsonNode catalog() {
        if (catalogCache == null || catalogAt.isBefore(Instant.now().minusSeconds(600))) {
            catalogCache = ai.catalog();
            catalogAt = Instant.now();
        }
        return catalogCache;
    }

    @Override
    @Transactional
    public ProviderDto setDefault(UUID userId, UUID providerId) {
        ModelProvider p = providers.findByIdAndUserId(providerId, userId)
                .orElseThrow(() -> ApiException.notFound("provider"));
        providers.clearDefault(userId);
        ModelProvider fresh = providers.findById(p.getId()).orElseThrow();
        fresh.setDefaultProvider(true);
        return toDto(providers.saveAndFlush(fresh));
    }

    @Override
    @Transactional(readOnly = true)
    public UUID defaultProviderId(UUID userId) {
        return providers.findByUserIdAndDefaultProviderTrue(userId).map(ModelProvider::getId).orElse(null);
    }

    @Override
    public ModelProvider loadFresh(UUID userId, UUID providerId) {
        ModelProvider p = providers.findByIdAndUserId(providerId, userId)
                .orElseThrow(() -> ApiException.notFound("provider"));
        String current;
        try {
            current = ai.capabilities().path("rulesVersion").asString(null);
        } catch (AiServiceException e) {
            return p;
        }
        if (current != null && !Objects.equals(current, p.getProfileRulesVersion())) {
            JsonNode profile = ai.profile(p.getKind().name(), p.getModel(), p.getProfileOverrides());
            p.setModelProfile(profile);
            p.setProfileRulesVersion(current);
            ModelProvider toSave = p;
            return tx.execute(s -> providers.save(toSave));
        }
        return p;
    }

    @Override
    public ProviderDto toDto(ModelProvider p) {
        boolean web = false;
        boolean images = false;
        try {
            JsonNode f = ai.capabilities().path("features");
            web = f.path("webSearch").asBoolean(false);
            images = p.getKind() == ProviderKind.HOST && f.path("images").asBoolean(false);
        } catch (AiServiceException ignored) {
            // features unknown while the AI service is down
        }
        return new ProviderDto(p.getId(), p.getName(), p.getKind(), ProviderKindSide.of(p.getKind()), p.getBaseUrl(),
                p.getModel(), p.getApiKeyEncrypted() != null, p.isDefaultProvider(), p.getStatus(),
                p.getLastTestedAt(), p.getLastTestMessage(), p.getModelProfile(),
                new ProviderDto.Features(true, true, web, true, images), p.getCreatedAt());
    }
}
