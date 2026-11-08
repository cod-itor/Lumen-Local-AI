package com.learnai.controller;

import com.learnai.dto.response.ProviderDto;
import com.learnai.security.CurrentUser;
import com.learnai.service.ProviderService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
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

    @PostMapping("/{id}/default")
    public ProviderDto setDefault(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return providers.setDefault(user.id(), id);
    }
}
