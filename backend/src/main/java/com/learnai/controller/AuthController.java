package com.learnai.controller;

import com.learnai.dto.request.LoginRequest;
import com.learnai.dto.request.RegisterRequest;
import com.learnai.dto.response.AuthResponse;
import com.learnai.dto.response.MeResponse;
import com.learnai.exception.ApiException;
import com.learnai.ratelimit.RateLimit;
import com.learnai.security.CookieService;
import com.learnai.security.CurrentUser;
import com.learnai.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Auth")
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CookieService cookies;

    @Operation(summary = "Create an account and log in")
    @RateLimit("auth.register.ip")
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest body, HttpServletRequest req,
                                                 HttpServletResponse res) {
        AuthService.Session s = authService.register(body, req.getHeader("X-Timezone"), req.getHeader(HttpHeaders.USER_AGENT));
        cookies.writeSession(res, s.response().accessToken(), s.refreshToken());
        return ResponseEntity.status(HttpStatus.CREATED).body(s.response());
    }

    @Operation(summary = "Log in with email and password")
    @RateLimit("auth.login.ip")
    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest body, HttpServletRequest req, HttpServletResponse res) {
        AuthService.Session s = authService.login(body, req.getHeader(HttpHeaders.USER_AGENT));
        cookies.writeSession(res, s.response().accessToken(), s.refreshToken());
        return s.response();
    }

    @Operation(summary = "Rotate the refresh token (cookie) and get a new access token")
    @PostMapping("/refresh")
    public AuthResponse refresh(HttpServletRequest req, HttpServletResponse res) {
        try {
            AuthService.Session s = authService.refresh(CookieService.read(req, CookieService.REFRESH).orElse(null),
                    req.getHeader(HttpHeaders.USER_AGENT));
            cookies.writeSession(res, s.response().accessToken(), s.refreshToken());
            return s.response();
        } catch (ApiException e) {
            cookies.clearSession(res);
            throw e;
        }
    }

    @Operation(summary = "Log out: revoke the refresh token and clear cookies")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest req, HttpServletResponse res) {
        authService.logout(CookieService.read(req, CookieService.REFRESH).orElse(null));
        cookies.clearSession(res);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Current user and settings")
    @GetMapping("/me")
    public MeResponse me(@AuthenticationPrincipal CurrentUser user) {
        return authService.me(user.id());
    }
}
