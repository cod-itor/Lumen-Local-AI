package com.learnai.controller;

import com.learnai.dto.response.JobDto;
import com.learnai.jobs.JobService;
import com.learnai.security.CurrentUser;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.UUID;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobs;

    @GetMapping("/{id}")
    public JobDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return jobs.get(user.id(), id);
    }

    @GetMapping(value = "/{id}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return jobs.events(user.id(), id);
    }

    @PostMapping("/{id}/cancel")
    public JobDto cancel(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return jobs.cancel(user.id(), id);
    }
}
