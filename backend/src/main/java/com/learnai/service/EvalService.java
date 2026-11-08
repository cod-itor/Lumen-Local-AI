package com.learnai.service;

import com.learnai.dto.request.CreateEvalRunRequest;
import com.learnai.dto.response.EvalDtos.EvalRunDetailDto;
import com.learnai.dto.response.EvalDtos.EvalRunDto;
import com.learnai.dto.response.EvalDtos.EvalSuiteDto;
import com.learnai.dto.response.PageResponse;

import java.util.List;
import java.util.UUID;

public interface EvalService {
    List<EvalSuiteDto> suites();

    EvalRunDto create(UUID userId, CreateEvalRunRequest r);

    PageResponse<EvalRunDto> list(UUID userId, UUID providerId, int page, int size);

    EvalRunDetailDto get(UUID userId, UUID runId);

    EvalRunDto cancel(UUID userId, UUID runId);
}
