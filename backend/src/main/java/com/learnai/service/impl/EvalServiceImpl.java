package com.learnai.service.impl;

import com.learnai.client.AiServiceClient;
import com.learnai.dto.request.CreateEvalRunRequest;
import com.learnai.dto.response.EvalDtos.EvalRunDetailDto;
import com.learnai.dto.response.EvalDtos.EvalRunDto;
import com.learnai.dto.response.EvalDtos.EvalSuiteDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.EvalRun;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.EvalMode;
import com.learnai.entity.enums.EvalRunStatus;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.exception.ApiException;
import com.learnai.harness.TurnOutcomeService;
import com.learnai.harness.TurnRegistry;
import com.learnai.harness.TurnStore;
import com.learnai.repository.EvalResultRepository;
import com.learnai.repository.EvalRunRepository;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.ModelProviderRepository;
import com.learnai.service.EvalService;
import com.learnai.service.eval.EvalMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Model Test runs (BACKEND.md §9.10, API_CONTRACT §6.10). Cases run as EVAL_CASE turns driven by the frontend. */
@Service
@RequiredArgsConstructor
public class EvalServiceImpl implements EvalService {

    private final EvalRunRepository runs;
    private final EvalResultRepository results;
    private final ModelProviderRepository providers;
    private final HarnessTurnRepository turns;
    private final TurnStore store;
    private final TurnOutcomeService outcomes;
    private final TurnRegistry registry;
    private final AiServiceClient ai;
    private final EvalMapper mapper;
    private final ObjectMapper json;
    private final TransactionTemplate tx;

    @Override
    public List<EvalSuiteDto> suites() {
        List<EvalSuiteDto> out = new ArrayList<>();
        for (JsonNode s : ai.suites()) {
            List<String> cats = new ArrayList<>();
            s.path("categories").forEach(c -> cats.add(c.asString()));
            out.add(new EvalSuiteDto(s.path("id").asString(), s.path("version").asInt(),
                    s.path("quickCount").asInt(), s.path("fullCount").asInt(), cats));
        }
        return out;
    }

    @Override
    @Transactional
    public EvalRunDto create(UUID userId, CreateEvalRunRequest r) {
        ModelProvider p = providers.findByIdAndUserId(r.providerId(), userId)
                .orElseThrow(() -> ApiException.notFound("provider"));
        JsonNode suite;
        try {
            suite = ai.suite(r.suite());
        } catch (RuntimeException e) {
            if (e instanceof com.learnai.client.AiServiceException ae && "NOT_FOUND".equals(ae.getCode())) {
                throw ApiException.notFound("suite");
            }
            throw e;
        }
        ArrayNode ids = json.createArrayNode();
        ObjectNode cats = json.createObjectNode();
        for (JsonNode c : suite.path("cases")) {
            if (r.mode() == EvalMode.QUICK && !c.path("quick").asBoolean(false)) continue;
            ids.add(c.path("id").asString());
            cats.put(c.path("id").asString(), c.path("category").asString());
        }
        if (ids.isEmpty()) throw ApiException.validation("mode", "This suite has no cases for this mode.");
        EvalRun run = runs.save(EvalRun.builder()
                .userId(userId).providerId(p.getId()).providerKind(p.getKind()).model(p.getModel())
                .suite(r.suite()).suiteVersion(suite.path("version").asInt(1)).mode(r.mode())
                .status(EvalRunStatus.RUNNING).caseIds(ids).caseCategories(cats).completedCases(0)
                .categoryScores(json.createObjectNode()).speed(json.createObjectNode())
                .rulesVersion(ai.capabilities().path("rulesVersion").asString(null)).build());
        return mapper.run(run);
    }

    @Override
    @Transactional(readOnly = true)
    public PageResponse<EvalRunDto> list(UUID userId, UUID providerId, int page, int size) {
        var pr = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100));
        var p = providerId == null ? runs.findByUserIdOrderByCreatedAtDesc(userId, pr)
                : runs.findByUserIdAndProviderIdOrderByCreatedAtDesc(userId, providerId, pr);
        return PageResponse.of(p, mapper::run);
    }

    @Override
    @Transactional(readOnly = true)
    public EvalRunDetailDto get(UUID userId, UUID runId) {
        EvalRun run = runs.findByIdAndUserId(runId, userId).orElseThrow(() -> ApiException.notFound("eval run"));
        return mapper.detail(run, results.findByRunIdOrderByCreatedAtAsc(run.getId()));
    }

    @Override
    public EvalRunDto cancel(UUID userId, UUID runId) {
        EvalRun run = runs.findByIdAndUserId(runId, userId).orElseThrow(() -> ApiException.notFound("eval run"));
        if (run.getStatus() != EvalRunStatus.RUNNING) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This test is not running.",
                    Map.of("currentState", run.getStatus().name()));
        }
        EvalRun saved = markCancelled(runId);
        for (UUID turnId : turns.findOpenByLockKey("run:" + runId)) {
            if (store.transition(turnId, TurnStatus.CANCELLED, TurnStatus.PREPARING, TurnStatus.AWAITING_APPROVAL,
                    TurnStatus.READY, TurnStatus.GENERATING)) {
                outcomes.onTerminal(turnId);
            }
            registry.get(turnId).ifPresent(h -> {
                h.requestCancel();
                if (h.writer != null) h.writer.finish("cancelled", Map.of("turnId", turnId));
            });
        }
        return mapper.run(saved);
    }

    private EvalRun markCancelled(UUID runId) {
        return tx.execute(s -> {
            EvalRun run = runs.findForUpdate(runId).orElseThrow();
            if (run.getStatus() == EvalRunStatus.RUNNING) {
                run.setStatus(EvalRunStatus.CANCELLED);
                run.setFinishedAt(Instant.now());
                runs.save(run);
            }
            return run;
        });
    }
}
