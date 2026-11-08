package com.learnai.service;

import com.learnai.dto.request.LoginRequest;
import com.learnai.dto.request.RegisterRequest;
import com.learnai.dto.response.AuthResponse;
import com.learnai.dto.response.MeResponse;

import java.util.UUID;

public interface AuthService {

    /** Result of an auth call: the body plus the raw refresh token for the cookie. */
    record Session(AuthResponse response, String refreshToken) {}

    Session register(RegisterRequest req, String timezoneHeader, String userAgent);

    Session login(LoginRequest req, String userAgent);

    Session refresh(String rawRefreshToken, String userAgent);

    void logout(String rawRefreshToken);

    MeResponse me(UUID userId);
}
