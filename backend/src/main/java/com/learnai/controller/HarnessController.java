package com.learnai.controller;

import com.learnai.dto.request.CancelTurnRequest;
import com.learnai.dto.request.CompleteTurnRequest;
import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.dto.response.CancelTurnResponse;
import com.learnai.dto.response.TurnDto;
import com.learnai.dto.response.TurnResult;
import com.learnai.ratelimit.RateLimit;
import com.learnai.security.CurrentUser;
import com.learnai.service.HarnessService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/harness/turns")
@RequiredArgsConstructor
public class HarnessController {

    private static final MediaType SSE = new MediaType("text", "event-stream", StandardCharsets.UTF_8);

    private final HarnessService harness;

    @Operation(summary = "Start a turn (SSE stream, API_CONTRACT §5.1)")
    @RateLimit("harness.create")
    @PostMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> start(@AuthenticationPrincipal CurrentUser user,
                                            @Valid @RequestBody HarnessTurnRequest request) {
        return ResponseEntity.ok().contentType(SSE)
                .header("Cache-Control", "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .body(harness.startTurn(user.id(), request));
    }

    @RateLimit("harness.complete")
    @PostMapping("/{id}/complete")
    public TurnResult complete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                               @Valid @RequestBody CompleteTurnRequest request) {
        return harness.complete(user.id(), id, request);
    }

    @PostMapping("/{id}/cancel")
    public CancelTurnResponse cancel(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                     @Valid @RequestBody(required = false) CancelTurnRequest request) {
        return harness.cancel(user.id(), id, request);
    }

    @GetMapping("/{id}")
    public TurnDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return harness.getTurn(user.id(), id);
    }
}
