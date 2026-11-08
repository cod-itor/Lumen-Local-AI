package com.learnai.service.eval;

import com.learnai.dto.response.EvalDtos.CategoryScore;
import com.learnai.dto.response.EvalDtos.EvalCheckDto;
import com.learnai.dto.response.EvalDtos.EvalResultDto;
import com.learnai.dto.response.EvalDtos.EvalRunDetailDto;
import com.learnai.dto.response.EvalDtos.EvalRunDto;
import com.learnai.dto.response.EvalDtos.Speed;
import com.learnai.entity.EvalResult;
import com.learnai.entity.EvalRun;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class EvalMapper {

    private final ObjectMapper json;

    public EvalResultDto result(EvalResult r) {
        List<EvalCheckDto> checks = new ArrayList<>();
        for (JsonNode c : r.getChecks()) {
            checks.add(new EvalCheckDto(c.path("name").asString(""), c.path("passed").asBoolean(false),
                    c.path("detail").asString(null)));
        }
        return new EvalResultDto(r.getCaseId(), r.getCategory(), r.isPassed(), checks, r.getOutput(),
                r.isGuardWouldBlock(), r.getStats() == null ? null : json.convertValue(r.getStats(), Map.class),
                r.getError(), r.getCreatedAt());
    }

    public EvalRunDto run(EvalRun r) {
        return new EvalRunDto(r.getId(), r.getProviderId(), r.getProviderKind(), r.getModel(), r.getSuite(),
                r.getMode(), r.getStatus(), caseIds(r), r.getCompletedCases(), dbl(r.getScore()), cats(r),
                dbl(r.getSafetyWithGuardrails()), speed(r), r.getCreatedAt(), r.getFinishedAt());
    }

    public EvalRunDetailDto detail(EvalRun r, List<EvalResult> results) {
        return new EvalRunDetailDto(r.getId(), r.getProviderId(), r.getProviderKind(), r.getModel(), r.getSuite(),
                r.getMode(), r.getStatus(), caseIds(r), r.getCompletedCases(), dbl(r.getScore()), cats(r),
                dbl(r.getSafetyWithGuardrails()), speed(r), r.getCreatedAt(), r.getFinishedAt(),
                results.stream().map(this::result).toList());
    }

    private static List<String> caseIds(EvalRun r) {
        List<String> out = new ArrayList<>();
        r.getCaseIds().forEach(n -> out.add(n.asString()));
        return out;
    }

    private static Map<String, CategoryScore> cats(EvalRun r) {
        Map<String, CategoryScore> out = new LinkedHashMap<>();
        r.getCategoryScores().properties().forEach(e -> out.put(e.getKey(), new CategoryScore(
                e.getValue().path("passed").asInt(), e.getValue().path("total").asInt(),
                e.getValue().path("score").asDouble())));
        return out;
    }

    private static Speed speed(EvalRun r) {
        JsonNode s = r.getSpeed();
        return new Speed(s.hasNonNull("avgTtftMs") ? s.get("avgTtftMs").asDouble() : null,
                s.hasNonNull("avgTokensPerSec") ? s.get("avgTokensPerSec").asDouble() : null);
    }

    private static Double dbl(Float f) {
        return f == null ? null : (double) f;
    }
}
