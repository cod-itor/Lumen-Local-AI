package com.learnai.dto.response;

import java.time.Instant;

public record AuthResponse(UserDto user, SettingsDto settings, String accessToken, Instant accessTokenExpiresAt) {
}
