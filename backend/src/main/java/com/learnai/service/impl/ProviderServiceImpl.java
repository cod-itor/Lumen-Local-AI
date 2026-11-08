package com.learnai.service.impl;

import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.client.AiEvent;
import com.learnai.dto.request.CreateProviderRequest;
import com.learnai.dto.request.ProviderTestResultRequest;
import com.learnai.dto.request.UpdateProviderRequest;
import com.learnai.dto.response.ProviderDto;
import com.learnai.entity.enums.ProviderStatus;
import org.springframework.http.HttpStatus;
import tools.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.regex.Pattern;
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

    private static final Pattern OLLAMA_URL = Pattern.compile("^http://(localhost|127\\.0\\.0\\.1)(:\\d{2,5})?$");
    private static final Pattern OLLAMA_TAG = Pattern.compile("^[a-zA-Z0-9._:/-]{1,100}$");
    private static final String DEFAULT_OLLAMA_URL = "http://localhost:11434";

    @Override
    public ProviderDto create(UUID userId, CreateProviderRequest r) {
        String baseUrl = null;
        String model = r.model().trim();
        switch (r.kind()) {
            case HOST -> throw ApiException.validation("kind", "The host model is added automatically.");
            case REMOTE_URL -> throw remoteDisabled();
            case BROWSER -> {
                if (r.baseUrl() != null) throw ApiException.validation("baseUrl", "baseUrl must be empty for a browser model");
                model = browserEntryId(model);
            }
            case LOCAL_OLLAMA -> {
                baseUrl = ollamaUrl(r.baseUrl());
                checkTag(model);
            }
        }
        JsonNode overrides = json.createObjectNode();
        JsonNode profile = ai.profile(r.kind().name(), model, overrides);
        String rulesVersion = rulesVersion();
        String finalModel = model;
        String finalBaseUrl = baseUrl;
        ModelProvider saved = tx.execute(s -> {
            boolean first = providers.findByUserIdOrderByCreatedAtAsc(userId).isEmpty();
            boolean makeDefault = first || Boolean.TRUE.equals(r.makeDefault());
            if (makeDefault) providers.clearDefault(userId);
            return providers.saveAndFlush(ModelProvider.builder()
                    .userId(userId).name(r.name().trim()).kind(r.kind()).baseUrl(finalBaseUrl).model(finalModel)
                    .modelProfile(profile).profileOverrides(overrides).profileRulesVersion(rulesVersion)
                    .defaultProvider(makeDefault).build());
        });
        return toDto(saved);
    }

    @Override
    public ProviderDto update(UUID userId, UUID providerId, UpdateProviderRequest r) {
        ModelProvider p = own(userId, providerId);
        if (r.name() != null) p.setName(r.name().trim());
        if (r.baseUrl() != null) {
            if (p.getKind() != ProviderKind.LOCAL_OLLAMA) {
                throw ApiException.validation("baseUrl", "Only a local Ollama connection has a base URL.");
            }
            String url = ollamaUrl(r.baseUrl());
            if (!url.equals(p.getBaseUrl())) {
                p.setBaseUrl(url);
                p.setStatus(ProviderStatus.UNTESTED);
            }
        }
        if (r.apiKey() != null) throw remoteDisabled();
        if (r.model() != null) {
            String model = switch (p.getKind()) {
                case BROWSER -> browserEntryId(r.model().trim());
                case LOCAL_OLLAMA -> checkTag(r.model().trim());
                case HOST -> hostModel(r.model().trim());
                case REMOTE_URL -> throw remoteDisabled();
            };
            if (!model.equals(p.getModel())) {
                ObjectNode none = json.createObjectNode();
                p.setModel(model);
                p.setProfileOverrides(none);
                p.setModelProfile(ai.profile(p.getKind().name(), model, none));
                p.setProfileRulesVersion(rulesVersion());
                p.setStatus(ProviderStatus.UNTESTED);
                p.setLastTestMessage(null);
                p.setLastTestedAt(null);
            }
        }
        return toDto(tx.execute(s -> providers.saveAndFlush(p)));
    }

    @Override
    public void delete(UUID userId, UUID providerId) {
        ModelProvider p = own(userId, providerId);
        if (p.getKind() == ProviderKind.HOST) {
            throw new ApiException(HttpStatus.CONFLICT, "CANNOT_DELETE_HOST", "The host model can't be removed.");
        }
        tx.executeWithoutResult(s -> {
            providers.delete(p);
            providers.flush();
            if (p.isDefaultProvider()) {
                List<ModelProvider> rest = providers.findByUserIdOrderByCreatedAtAsc(userId);
                ModelProvider next = rest.stream().filter(x -> x.getKind() == ProviderKind.HOST).findFirst()
                        .orElse(rest.isEmpty() ? null : rest.getFirst());
                if (next != null) next.setDefaultProvider(true);
            }
        });
    }

    @Override
    public ProviderDto testResult(UUID userId, UUID providerId, ProviderTestResultRequest r) {
        ModelProvider p = own(userId, providerId);
        if (ProviderKindSide.of(p.getKind()) != com.learnai.entity.enums.GenerationSide.CLIENT) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This model is tested by the server.");
        }
        boolean ok = Boolean.TRUE.equals(r.ok()) && r.checks().stream().allMatch(ProviderTestResultRequest.Check::ok);
        String message = r.checks().stream().filter(c -> !c.ok()).map(ProviderTestResultRequest.Check::message)
                .filter(Objects::nonNull).findFirst().orElse(ok ? "Connection works." : "The test failed.");
        p.setStatus(ok ? ProviderStatus.OK : ProviderStatus.FAILED);
        p.setLastTestedAt(Instant.now());
        p.setLastTestMessage(message.length() > 500 ? message.substring(0, 500) : message);
        Integer ctx = r.modelInfo() == null ? null : r.modelInfo().contextLength();
        int current = p.getModelProfile().path("contextWindow").asInt(0);
        if (ctx != null && ctx > 0 && current > 0 && ctx < current) {
            ObjectNode overrides = p.getProfileOverrides() instanceof ObjectNode o
                    ? (ObjectNode) o.deepCopy() : json.createObjectNode();
            overrides.put("contextWindow", ctx);
            p.setProfileOverrides(overrides);
            p.setModelProfile(ai.profile(p.getKind().name(), p.getModel(), overrides));
            p.setProfileRulesVersion(rulesVersion());
        }
        return toDto(tx.execute(s -> providers.saveAndFlush(p)));
    }

    @Override
    public ProviderDto test(UUID userId, UUID providerId) {
        ModelProvider p = own(userId, providerId);
        if (p.getKind() != ProviderKind.HOST) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This model is tested in your browser.");
        }
        ObjectNode g = json.createObjectNode().put("turnId", "provider-test-" + p.getId());
        g.putObject("target").put("kind", p.getKind().name()).put("model", p.getModel());
        g.putArray("messages").addObject().put("role", "user").put("content", "Reply with the word OK.");
        g.putObject("params").put("temperature", 0.0).put("topP", 0.9).put("maxTokens", 5)
                .put("numCtx", 2048).put("repeatPenalty", 1.0).putArray("stop");
        g.putNull("outputSchema");
        g.set("modelProfile", p.getModelProfile());
        g.putObject("clientGuard").putArray("stopPatterns");
        StringBuilder out = new StringBuilder();
        String error = null;
        try {
            for (AiEvent ev : ai.generate(g).take(Duration.ofSeconds(90)).toIterable()) {
                if ("token".equals(ev.name())) out.append(ev.data().path("text").asString(""));
                if ("error".equals(ev.name())) error = ev.data().path("message").asString("The model failed to answer.");
            }
        } catch (AiServiceException e) {
            error = e.getMessage();
        }
        boolean ok = error == null && out.toString().toLowerCase(java.util.Locale.ROOT).contains("ok");
        p.setStatus(ok ? ProviderStatus.OK : ProviderStatus.FAILED);
        p.setLastTestedAt(Instant.now());
        String msg = ok ? "Connection works." : error != null ? error : "The model didn't answer as expected.";
        p.setLastTestMessage(msg.length() > 500 ? msg.substring(0, 500) : msg);
        return toDto(tx.execute(s -> providers.saveAndFlush(p)));
    }

    private ModelProvider own(UUID userId, UUID providerId) {
        return providers.findByIdAndUserId(providerId, userId).orElseThrow(() -> ApiException.notFound("provider"));
    }

    private static ApiException remoteDisabled() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE",
                "Remote model URLs are turned off on this server.");
    }

    private String browserEntryId(String model) {
        for (JsonNode m : catalog().path("browser").path("models")) {
            if (model.equals(m.path("id").asString()) || model.equals(m.path("fallbackId").asString())) {
                return m.path("id").asString();
            }
        }
        throw ApiException.validation("model", "model must be one of the browser models in the catalog");
    }

    private String hostModel(String model) {
        for (JsonNode m : ai.capabilities().path("hostChatModels")) {
            if (model.equals(m.asString())) return model;
        }
        throw ApiException.validation("model", "model must be one of the server's chat models");
    }

    private static String ollamaUrl(String raw) {
        String url = raw == null || raw.isBlank() ? DEFAULT_OLLAMA_URL : raw.trim().replaceAll("/+$", "");
        if (!OLLAMA_URL.matcher(url).matches()) {
            throw ApiException.validation("baseUrl", "baseUrl must be http://localhost:<port> or http://127.0.0.1:<port>");
        }
        return url;
    }

    private static String checkTag(String model) {
        if (!OLLAMA_TAG.matcher(model).matches()) {
            throw ApiException.validation("model", "model must be an Ollama tag like qwen3.5:2b");
        }
        return model;
    }

    private String rulesVersion() {
        try {
            return ai.capabilities().path("rulesVersion").asString(null);
        } catch (AiServiceException e) {
            return null;
        }
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
