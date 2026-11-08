package com.learnai.service.impl;

import com.learnai.dto.request.UpdateSettingsRequest;
import com.learnai.dto.response.SettingsDto;
import com.learnai.entity.UserSettings;
import com.learnai.entity.enums.GuardProfile;
import com.learnai.exception.ApiException;
import com.learnai.mapper.UserMapper;
import com.learnai.repository.UserRepository;
import com.learnai.repository.UserSettingsRepository;
import com.learnai.service.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettingsServiceImpl implements SettingsService {

    private final UserSettingsRepository settingsRepo;
    private final UserRepository users;
    private final UserMapper mapper;

    @Override
    @Transactional
    public SettingsDto get(UUID userId) {
        return mapper.toDto(load(userId), defaultProviderId(userId));
    }

    @Override
    @Transactional
    public SettingsDto update(UUID userId, UpdateSettingsRequest r) {
        UserSettings s = load(userId);
        if (r.theme() != null) s.setTheme(r.theme());
        if (r.uiLanguage() != null) s.setUiLanguage(r.uiLanguage());
        if (r.outputLanguage() != null) s.setOutputLanguage(r.outputLanguage());
        if (r.answerLength() != null) s.setAnswerLength(r.answerLength());
        if (r.temperature() != null) {
            s.setTemperature(r.temperature().map(t -> BigDecimal.valueOf(t).setScale(2, RoundingMode.HALF_UP)).orElse(null));
        }
        if (r.askBeforeSearch() != null) s.setAskBeforeSearch(r.askBeforeSearch());
        if (r.guardProfile() != null) s.setGuardProfile(GuardProfile.valueOf(r.guardProfile()));
        if (r.timezone() != null) {
            if (!AuthServiceImpl.validZone(r.timezone())) throw ApiException.validation("timezone", "timezone is not a valid IANA zone");
            s.setTimezone(r.timezone());
        }
        if (r.showSpeedStats() != null) s.setShowSpeedStats(r.showSpeedStats());
        if (r.defaultProviderId() != null) {
            // Providers arrive in phase 3 (ProviderService); until then no provider id can be valid.
            throw ApiException.validation("defaultProviderId", "defaultProviderId must be one of your providers");
        }
        return mapper.toDto(s, defaultProviderId(userId));
    }

    private UserSettings load(UUID userId) {
        return settingsRepo.findById(userId).orElseGet(() -> settingsRepo.save(UserSettings.builder()
                .user(users.findById(userId).orElseThrow(ApiException::unauthenticated)).build()));
    }

    private UUID defaultProviderId(UUID userId) {
        return null;
    }
}
