package com.learnai.controller;

import com.learnai.client.AiServiceClient;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;

/** API_CONTRACT §6.11: GET /api/system/status (cached 10 s). */
@RestController
@RequiredArgsConstructor
public class SystemController {

    private static final String[] FEATURES =
            {"hostChat", "images", "bgRemoval", "voice", "tts", "translation", "webSearch", "guardClassifier"};

    private final AiServiceClient ai;
    private final ObjectMapper json;

    private volatile ObjectNode cached;
    private volatile Instant cachedAt = Instant.EPOCH;

    @GetMapping("/api/system/status")
    public JsonNode status() {
        if (cached != null && cachedAt.isAfter(Instant.now().minusSeconds(10))) return cached;
        ObjectNode out = json.createObjectNode();
        String version = getClass().getPackage().getImplementationVersion();
        out.putObject("backend").put("version", version == null ? "dev" : version);
        ObjectNode a = out.putObject("ai");
        ObjectNode f = json.createObjectNode();
        try {
            JsonNode caps = ai.capabilities();
            a.put("reachable", true).put("profile", caps.path("profile").asString(null));
            for (String k : FEATURES) f.put(k, caps.path("features").path(k).asBoolean(false));
        } catch (RuntimeException e) {
            a.put("reachable", false).putNull("profile");
            for (String k : FEATURES) f.put(k, false);
        }
        a.set("features", f);
        JsonNode st = null;
        if (a.path("reachable").asBoolean()) {
            try {
                st = ai.status();
            } catch (RuntimeException ignored) {
                // loaded models / queue are informational only
            }
        }
        a.set("loadedModels", st != null && st.has("loadedModels") ? st.get("loadedModels") : json.createArrayNode());
        JsonNode q = st == null ? null : st.get("queue");
        a.putObject("queue")
                .put("heavyJobsQueued", q == null ? 0 : q.path("heavyJobsQueued").asInt(0))
                .put("heavyJobRunning", q != null && q.path("heavyJobRunning").asBoolean(false));
        cached = out;
        cachedAt = Instant.now();
        return out;
    }
}
