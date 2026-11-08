package com.learnai.controller;

import com.learnai.dto.request.UpdateSettingsRequest;
import com.learnai.dto.response.SettingsDto;
import com.learnai.security.CurrentUser;
import com.learnai.service.SettingsService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Settings")
@RestController
@RequestMapping("/api/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final SettingsService settingsService;

    @GetMapping
    public SettingsDto get(@AuthenticationPrincipal CurrentUser user) {
        return settingsService.get(user.id());
    }

    @PatchMapping
    public SettingsDto update(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody UpdateSettingsRequest body) {
        return settingsService.update(user.id(), body);
    }
}
