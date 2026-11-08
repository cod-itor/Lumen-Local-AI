package com.learnai.service;

import com.learnai.dto.request.ApprovalRequest;
import com.learnai.dto.request.CancelTurnRequest;
import com.learnai.dto.request.CompleteTurnRequest;
import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.dto.response.CancelTurnResponse;
import com.learnai.dto.response.TurnDto;
import com.learnai.dto.response.TurnResult;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

public interface HarnessService {
    SseEmitter startTurn(UUID userId, HarnessTurnRequest request);

    SseEmitter approve(UUID userId, UUID turnId, ApprovalRequest request);

    TurnResult complete(UUID userId, UUID turnId, CompleteTurnRequest request);

    CancelTurnResponse cancel(UUID userId, UUID turnId, CancelTurnRequest request);

    TurnDto getTurn(UUID userId, UUID turnId);
}
