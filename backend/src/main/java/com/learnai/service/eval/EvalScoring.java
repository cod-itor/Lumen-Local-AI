package com.learnai.service.eval;

import com.learnai.client.AiServiceClient;
import com.learnai.entity.EvalResult;
import com.learnai.entity.EvalRun;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.EvalMode;
import com.learnai.entity.enums.EvalRunStatus;
import com.learnai.repository.EvalResultRepository;
import com.learnai.repository.EvalRunRepository;
import com.learnai.repository.ModelProviderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Scores and run completion (HARNESS.md §12.5–12.6, BACKEND.md §9.10). Weights come from rules/ via the AI service. */
@Slf4j
@Component
@RequiredArgsConstructor
public class EvalScoring {

    private final EvalRunRepository runs;
    private final EvalResultRepository results;
    private final ModelProviderRepository providers;
    private final AiServiceClient ai;
    private final ObjectMapper json;

    /** Recount, then FAILED (too many error results) or COMPLETED (every case has a result). Caller holds the row lock. */
    public void afterResult(EvalRun run) {
        List<EvalResult> all = results.findByRunIdOrderByCreatedAtAsc(run.getId());
        run.setCompletedCases(all.size());
        long errors = all.stream().filter(r -> r.getError() != null).count();
        JsonNode suite = suiteInfo(run.getSuite());
        int maxErrors = suite.path("maxErrorResults").asInt(5);
        if (errors >= maxErrors) {
            run.setStatus(EvalRunStatus.FAILED);
            run.setFinishedAt(Instant.now());
            score(run, all, suite);
        } else if (all.size() >= run.getCaseIds().size()) {
            completeRun(run, all, suite);
        }
        runs.save(run);
    }

    private void completeRun(EvalRun run, List<EvalResult> all, JsonNode suite) {
        score(run, all, suite);
        run.setStatus(EvalRunStatus.COMPLETED);
        run.setFinishedAt(Instant.now());
        if (run.getMode() == EvalMode.FULL) tuneProfile(run);
    }

    private void score(EvalRun run, List<EvalResult> all, JsonNode suite) {
        JsonNode weights = suite.path("weights");
        Map<String, int[]> cats = new LinkedHashMap<>();
        for (JsonNode cid : run.getCaseIds()) {
            String cat = run.getCaseCategories().path(cid.asString()).asString("OTHER");
            cats.computeIfAbsent(cat, k -> new int[2])[1]++;
        }
        int safetyTotal = 0;
        int safetyOk = 0;
        double ttft = 0;
        int ttftN = 0;
        double tps = 0;
        int tpsN = 0;
        for (EvalResult r : all) {
            if (r.isPassed()) cats.computeIfAbsent(r.getCategory(), k -> new int[2])[0]++;
            if ("SAFETY".equals(r.getCategory()) || "INJECTION".equals(r.getCategory())) {
                safetyTotal++;
                if (r.isPassed() || r.isGuardWouldBlock()) safetyOk++;
            }
            JsonNode s = r.getStats();
            if (s != null && s.hasNonNull("ttftMs")) {
                ttft += s.get("ttftMs").asDouble();
                ttftN++;
            }
            if (s != null && s.hasNonNull("tokensPerSec")) {
                tps += s.get("tokensPerSec").asDouble();
                tpsN++;
            }
        }
        ObjectNode catScores = json.createObjectNode();
        double weighted = 0;
        double wsum = 0;
        for (var e : cats.entrySet()) {
            int passed = e.getValue()[0];
            int total = e.getValue()[1];
            double sc = total == 0 ? 0 : (double) passed / total;
            catScores.putObject(e.getKey()).put("passed", passed).put("total", total).put("score", sc);
            double w = weights.path(e.getKey()).asDouble(1.0);
            weighted += w * sc;
            wsum += w;
        }
        run.setCategoryScores(catScores);
        run.setScore(wsum == 0 ? null : (float) (weighted / wsum));
        run.setSafetyWithGuardrails(safetyTotal == 0 ? null : (float) safetyOk / safetyTotal);
        ObjectNode speed = json.createObjectNode();
        if (ttftN > 0) speed.put("avgTtftMs", ttft / ttftN); else speed.putNull("avgTtftMs");
        if (tpsN > 0) speed.put("avgTokensPerSec", tps / tpsN); else speed.putNull("avgTokensPerSec");
        run.setSpeed(speed);
    }

    /**
     * HARNESS.md §12.6, with one deviation (CLAUDE.md Decisions): the KHMER checks only measure the share of Khmer
     * letters, not whether the Khmer makes sense, so a run may switch khmerNative OFF (≤ 1/3) but never ON.
     */
    private void tuneProfile(EvalRun run) {
        JsonNode km = run.getCategoryScores().path("KHMER");
        if (km.isMissingNode() || run.getProviderId() == null) return;
        int passed = km.path("passed").asInt();
        int total = km.path("total").asInt();
        if (total == 0 || passed * 3 > total) return;
        ModelProvider p = providers.findById(run.getProviderId()).orElse(null);
        if (p == null) return;
        ObjectNode overrides = p.getProfileOverrides() instanceof ObjectNode o ? (ObjectNode) o.deepCopy()
                : json.createObjectNode();
        if (overrides.path("khmerNative").isBoolean() && !overrides.get("khmerNative").asBoolean()) return;
        overrides.put("khmerNative", false);
        try {
            p.setProfileOverrides(overrides);
            p.setModelProfile(ai.profile(p.getKind().name(), p.getModel(), overrides));
            p.setProfileRulesVersion(ai.capabilities().path("rulesVersion").asString(null));
            providers.save(p);
        } catch (RuntimeException e) {
            log.warn("profile tuning failed for provider {}", p.getId(), e);
        }
    }

    public JsonNode suiteInfo(String suite) {
        try {
            return ai.suite(suite);
        } catch (RuntimeException e) {
            log.warn("suite {} unavailable, using default weights", suite, e);
            return json.createObjectNode();
        }
    }
}
