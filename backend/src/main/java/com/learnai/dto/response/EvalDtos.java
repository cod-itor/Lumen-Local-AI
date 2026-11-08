package com.learnai.dto.response;

import com.learnai.entity.enums.EvalMode;
import com.learnai.entity.enums.EvalRunStatus;
import com.learnai.entity.enums.ProviderKind;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** API_CONTRACT §4.10 Model Test DTOs. */
public final class EvalDtos {

    private EvalDtos() {}

    public record EvalSuiteDto(String id, int version, int quickCount, int fullCount, List<String> categories) {}

    public record EvalCheckDto(String name, boolean passed, String detail) {}

    public record EvalResultDto(String caseId, String category, boolean passed, List<EvalCheckDto> checks,
                                String output, boolean guardWouldBlock, Object stats, String error,
                                Instant createdAt) {}

    public record CategoryScore(int passed, int total, double score) {}

    public record Speed(Double avgTtftMs, Double avgTokensPerSec) {}

    public record EvalRunDto(UUID id, UUID providerId, ProviderKind providerKind, String model, String suite,
                             EvalMode mode, EvalRunStatus status, List<String> caseIds, int completedCases,
                             Double score, Map<String, CategoryScore> categoryScores, Double safetyWithGuardrails,
                             Speed speed, Instant createdAt, Instant finishedAt) {}

    public record EvalRunDetailDto(UUID id, UUID providerId, ProviderKind providerKind, String model, String suite,
                                   EvalMode mode, EvalRunStatus status, List<String> caseIds, int completedCases,
                                   Double score, Map<String, CategoryScore> categoryScores,
                                   Double safetyWithGuardrails, Speed speed, Instant createdAt, Instant finishedAt,
                                   List<EvalResultDto> results) {}
}
