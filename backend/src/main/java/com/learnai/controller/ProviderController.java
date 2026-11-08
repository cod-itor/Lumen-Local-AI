package com.learnai.controller;

import com.learnai.dto.request.CreateProviderRequest;
import com.learnai.dto.request.ProviderTestResultRequest;
import com.learnai.dto.request.UpdateProviderRequest;
import com.learnai.dto.response.ProviderDto;
import com.learnai.security.CurrentUser;
import com.learnai.service.ProviderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/providers")
@RequiredArgsConstructor
public class ProviderController {

    private final ProviderService providers;

    @GetMapping
    public List<ProviderDto> list(@AuthenticationPrincipal CurrentUser user) {
        return providers.list(user.id());
    }

    @GetMapping("/catalog")
    public JsonNode catalog() {
        return providers.catalog();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProviderDto create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody CreateProviderRequest r) {
        return providers.create(user.id(), r);
    }

    @PatchMapping("/{id}")
    public ProviderDto update(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                              @Valid @RequestBody UpdateProviderRequest r) {
        return providers.update(user.id(), id, r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        providers.delete(user.id(), id);
    }

    @PostMapping("/{id}/default")
    public ProviderDto setDefault(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return providers.setDefault(user.id(), id);
    }

    @PostMapping("/{id}/test-result")
    public ProviderDto testResult(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                  @Valid @RequestBody ProviderTestResultRequest r) {
        return providers.testResult(user.id(), id, r);
    }

    @PostMapping("/{id}/test")
    public ProviderDto test(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return providers.test(user.id(), id);
    }
}
