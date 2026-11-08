package com.learnai.controller;

import com.learnai.dto.request.CreateEvalRunRequest;
import com.learnai.dto.response.EvalDtos.EvalRunDetailDto;
import com.learnai.dto.response.EvalDtos.EvalRunDto;
import com.learnai.dto.response.EvalDtos.EvalSuiteDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.security.CurrentUser;
import com.learnai.service.EvalService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** API_CONTRACT §6.10 Model Test. */
@RestController
@RequestMapping("/api/evals")
@RequiredArgsConstructor
@Tag(name = "Model Test")
public class EvalController {

    private final EvalService evals;

    @GetMapping("/suites")
    @Operation(summary = "List Model Test suites")
    public List<EvalSuiteDto> suites() {
        return evals.suites();
    }

    @PostMapping("/runs")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Start a Model Test run (the frontend then runs each case as an EVAL_CASE turn)")
    public EvalRunDto create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody CreateEvalRunRequest r) {
        return evals.create(user.id(), r);
    }

    @GetMapping("/runs")
    @Operation(summary = "List runs, newest first")
    public PageResponse<EvalRunDto> list(@AuthenticationPrincipal CurrentUser user,
                                         @RequestParam(required = false) UUID providerId,
                                         @RequestParam(defaultValue = "0") int page,
                                         @RequestParam(defaultValue = "20") int size) {
        return evals.list(user.id(), providerId, page, size);
    }

    @GetMapping("/runs/{id}")
    @Operation(summary = "A run with its results")
    public EvalRunDetailDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return evals.get(user.id(), id);
    }

    @PostMapping("/runs/{id}/cancel")
    @Operation(summary = "Cancel a running run (results are kept)")
    public EvalRunDto cancel(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return evals.cancel(user.id(), id);
    }
}
