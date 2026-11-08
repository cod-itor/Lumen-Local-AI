package com.learnai.service;

import com.learnai.dto.request.UpdateSettingsRequest;
import com.learnai.dto.response.SettingsDto;

import java.util.UUID;

public interface SettingsService {

    SettingsDto get(UUID userId);

    SettingsDto update(UUID userId, UpdateSettingsRequest req);
}
