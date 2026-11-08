package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.EvalResult;
import com.learnai.entity.EvalRun;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.enums.EvalRunStatus;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.exception.ApiException;
import com.learnai.repository.EvalResultRepository;
import com.learnai.repository.EvalRunRepository;
import com.learnai.service.eval.EvalMapper;
import com.learnai.service.eval.EvalScoring;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.UUID;

/** EVAL_CASE (HARNESS.md §12.2, BACKEND.md §7.6 EvalCaseTaskHandler, §7.9). Lock: run:{runId}. */
@Component
@RequiredArgsConstructor
public class EvalCaseTaskHandler implements TaskHandler {

    private final EvalRunRepository runs;
    private final EvalResultRepository results;
    private final EvalScoring scoring;
    private final EvalMapper mapper;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.EVAL_CASE;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        if (r.target() == null || !"EVAL_RUN".equals(r.target().type())) {
            throw ApiException.validation("target", "EVAL_CASE needs target { type: EVAL_RUN, id }.");
        }
        Object caseId = r.taskInput() == null ? null : r.taskInput().get("caseId");
        if (!(caseId instanceof String cid) || cid.isBlank()) {
            throw ApiException.validation("taskInput.caseId", "caseId is required.");
        }
        EvalRun run = runs.findByIdAndUserId(r.target().id(), userId)
                .orElseThrow(() -> ApiException.notFound("eval run"));
        if (run.getStatus() != EvalRunStatus.RUNNING) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This test is not running.",
                    java.util.Map.of("currentState", run.getStatus().name()));
        }
        boolean known = false;
        for (JsonNode c : run.getCaseIds()) known |= cid.equals(c.asString());
        if (!known) throw ApiException.validation("taskInput.caseId", "This case is not part of the run.");
        results.findByRunIdAndCaseId(run.getId(), cid).filter(x -> x.getError() == null).ifPresent(x -> {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This case already has a result.");
        });
        if (!run.getProviderId().equals(r.providerId())) {
            throw ApiException.validation("providerId", "Use the provider the test was started with.");
        }
        return new Target("EVAL_RUN", run.getId(), null, "run:" + run.getId());
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        EvalRun run = runs.findById(t.getTargetId()).orElseThrow();
        return json.createObjectNode().put("suite", run.getSuite()).put("caseId", caseId(t));
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        EvalRun run = runs.findForUpdate(t.getTargetId()).orElseThrow(() -> new Discard("run deleted"));
        if (run.getStatus() != EvalRunStatus.RUNNING) throw new Discard("run not running");
        JsonNode er = r.path("evalResult");
        if (!er.isObject()) throw new IllegalStateException("finalize returned no evalResult");
        String cid = caseId(t);
        EvalResult res = results.findByRunIdAndCaseId(run.getId(), cid).orElseGet(EvalResult::new);
        res.setRunId(run.getId());
        res.setCaseId(cid);
        res.setCategory(er.path("category").asString(run.getCaseCategories().path(cid).asString("OTHER")));
        res.setPassed(er.path("passed").asBoolean(false));
        res.setChecks(er.path("checks").isArray() ? er.get("checks") : json.createArrayNode());
        res.setOutput(er.path("output").asString(""));
        res.setGuardWouldBlock(er.path("guardWouldBlock").asBoolean(false));
        res.setStats(er.path("stats").isObject() ? er.get("stats") : null);
        res.setError(null);
        res.setCreatedAt(Instant.now());
        res = results.saveAndFlush(res);
        scoring.afterResult(run);
        return mapper.result(res);
    }

    @Override
    public void onTerminal(HarnessTurn t, TurnStatus status) {
        if (status != TurnStatus.FAILED && status != TurnStatus.EXPIRED) return;
        EvalRun run = runs.findForUpdate(t.getTargetId()).orElse(null);
        if (run == null || run.getStatus() != EvalRunStatus.RUNNING) return;
        String cid = caseId(t);
        EvalResult res = results.findByRunIdAndCaseId(run.getId(), cid).orElseGet(EvalResult::new);
        if (res.getId() != null && res.getError() == null) return;
        res.setRunId(run.getId());
        res.setCaseId(cid);
        res.setCategory(run.getCaseCategories().path(cid).asString("OTHER"));
        res.setPassed(false);
        res.setChecks(json.createArrayNode());
        res.setOutput("");
        res.setGuardWouldBlock(false);
        res.setStats(null);
        String code = status == TurnStatus.EXPIRED ? "TURN_EXPIRED"
                : t.getErrorCode() == null ? "INTERNAL_ERROR" : t.getErrorCode();
        res.setError(code.length() > 40 ? code.substring(0, 40) : code);
        res.setCreatedAt(Instant.now());
        results.saveAndFlush(res);
        scoring.afterResult(run);
    }

    private static String caseId(HarnessTurn t) {
        return t.getRequest().path("taskInput").path("caseId").asString();
    }
}
