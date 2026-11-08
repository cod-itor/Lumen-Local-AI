package com.learnai.client;

import com.learnai.config.AppProperties;
import io.netty.channel.ChannelOption;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.reactive.ReactorClientHttpConnector;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientRequestException;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.netty.http.client.HttpClient;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.TimeoutException;

/** All calls to the AI service (BACKEND.md §8). Bodies are sent and parsed as JSON text. */
@Slf4j
@Component
public class AiServiceClient {

    private static final ParameterizedTypeReference<ServerSentEvent<String>> SSE =
            new ParameterizedTypeReference<>() {};

    private final WebClient web;
    private final ObjectMapper json;
    private final AppProperties.AiService cfg;
    private volatile JsonNode capabilities;
    private volatile Instant capabilitiesAt = Instant.EPOCH;

    public AiServiceClient(AppProperties props, ObjectMapper json) {
        this.cfg = props.aiService();
        this.json = json;
        HttpClient http = HttpClient.create()
                .option(ChannelOption.CONNECT_TIMEOUT_MILLIS, cfg.connectTimeoutMs() > 0 ? cfg.connectTimeoutMs() : 5000);
        this.web = WebClient.builder().baseUrl(cfg.url())
                .defaultHeader("X-Internal-Token", cfg.token() == null ? "" : cfg.token())
                .clientConnector(new ReactorClientHttpConnector(http))
                .codecs(c -> c.defaultCodecs().maxInMemorySize(4 * 1024 * 1024))
                .build();
    }

    // ------------------------------------------------------------------ JSON calls

    /** Cached for 10 s (BACKEND.md §9.5). */
    public JsonNode capabilities() {
        if (capabilities != null && capabilitiesAt.isAfter(Instant.now().minusSeconds(10))) return capabilities;
        JsonNode c = getJson("/capabilities", Duration.ofSeconds(5));
        capabilities = c;
        capabilitiesAt = Instant.now();
        return c;
    }

    public JsonNode profile(String kind, String model, JsonNode overrides) {
        ObjectNode body = json.createObjectNode().put("kind", kind).put("model", model);
        body.set("overrides", overrides == null ? json.createObjectNode() : overrides);
        return postJson("/models/profile", body, Duration.ofSeconds(5));
    }

    public JsonNode catalog() {
        return getJson("/models/catalog", Duration.ofSeconds(5));
    }

    public JsonNode finalizeTurn(JsonNode req) {
        return postJson("/harness/finalize", req, Duration.ofSeconds(cfg.finalizeTimeoutS()));
    }

    // ------------------------------------------------------------------ streams

    public Flux<AiEvent> prepare(JsonNode req) {
        return stream("/harness/prepare", req, Duration.ofSeconds(cfg.prepareTimeoutS()));
    }

    /** POST /rag/ingest (AI_SERVICE.md §13): progress / done / error events. */
    public Flux<AiEvent> ingest(JsonNode req) {
        return stream("/rag/ingest", req, Duration.ofSeconds(cfg.jobTimeoutS()));
    }

    public void deleteDocumentChunks(java.util.UUID documentId) {
        web.delete().uri("/rag/documents/{id}", documentId).retrieve().toBodilessEntity()
                .timeout(Duration.ofSeconds(30)).onErrorMap(this::map).block();
    }

    public Flux<AiEvent> generate(JsonNode req) {
        return stream("/generate", req, Duration.ofSeconds(cfg.generateIdleTimeoutS()));
    }

    private Flux<AiEvent> stream(String path, JsonNode body, Duration idle) {
        return web.post().uri(path)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.TEXT_EVENT_STREAM)
                .bodyValue(json.writeValueAsString(body))
                .retrieve()
                .bodyToFlux(SSE)
                .filter(e -> e.event() != null && e.data() != null)
                .map(e -> new AiEvent(e.event(), json.readTree(e.data())))
                .timeout(idle)
                .onErrorMap(this::map);
    }

    private JsonNode getJson(String path, Duration timeout) {
        return web.get().uri(path).retrieve().bodyToMono(String.class)
                .timeout(timeout).onErrorMap(this::map)
                .map(json::readTree).block();
    }

    private JsonNode postJson(String path, JsonNode body, Duration timeout) {
        return web.post().uri(path).contentType(MediaType.APPLICATION_JSON)
                .bodyValue(json.writeValueAsString(body))
                .retrieve().bodyToMono(String.class)
                .timeout(timeout).onErrorMap(this::map)
                .map(json::readTree).block();
    }

    private Throwable map(Throwable t) {
        if (t instanceof AiServiceException) return t;
        if (t instanceof TimeoutException) return AiServiceException.timeout();
        if (t instanceof WebClientRequestException) {
            return t.getCause() instanceof TimeoutException ? AiServiceException.timeout()
                    : AiServiceException.unavailable();
        }
        if (t instanceof WebClientResponseException r) {
            String code = "AI_SERVICE_UNAVAILABLE";
            String message = "The AI service failed.";
            try {
                JsonNode b = json.readTree(r.getResponseBodyAsString());
                if (b.hasNonNull("code")) code = b.get("code").asString();
                if (b.hasNonNull("message")) message = b.get("message").asString();
            } catch (RuntimeException ignored) {
                // not a JSON error body
            }
            log.warn("AI service {} {}: {}", r.getStatusCode().value(), code, message);
            HttpStatus status = switch (code) {
                case "FEATURE_UNAVAILABLE", "PROVIDER_UNAVAILABLE", "NOT_IMPLEMENTED" -> HttpStatus.SERVICE_UNAVAILABLE;
                case "CONTEXT_TOO_SMALL", "RULES_INVALID" -> HttpStatus.UNPROCESSABLE_CONTENT;
                default -> r.getStatusCode().is4xxClientError() ? HttpStatus.BAD_GATEWAY : HttpStatus.SERVICE_UNAVAILABLE;
            };
            return new AiServiceException(status, code, message, r.getStatusCode().is5xxServerError());
        }
        log.warn("AI service call failed", t);
        return AiServiceException.unavailable();
    }
}
