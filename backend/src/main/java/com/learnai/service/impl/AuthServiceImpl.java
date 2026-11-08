package com.learnai.service.impl;

import com.learnai.config.AppProperties;
import com.learnai.dto.request.LoginRequest;
import com.learnai.dto.request.RegisterRequest;
import com.learnai.dto.response.AuthResponse;
import com.learnai.dto.response.MeResponse;
import com.learnai.entity.RefreshToken;
import com.learnai.entity.User;
import com.learnai.entity.UserSettings;
import com.learnai.entity.enums.Role;
import com.learnai.exception.ApiException;
import com.learnai.mapper.UserMapper;
import com.learnai.ratelimit.RateLimiter;
import com.learnai.repository.RefreshTokenRepository;
import com.learnai.repository.UserRepository;
import com.learnai.repository.UserSettingsRepository;
import com.learnai.security.JwtService;
import com.learnai.service.AuthService;
import com.learnai.util.Hashing;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DateTimeException;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Locale;
import java.util.UUID;

/** Register, login, refresh rotation with reuse detection, logout (BACKEND.md §5.3). */
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    /** BCrypt hash of a random string, so unknown emails take as long as wrong passwords. */
    private volatile String dummyHash;

    private final UserRepository users;
    private final UserSettingsRepository settingsRepo;
    private final RefreshTokenRepository tokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserMapper mapper;
    private final AppProperties props;
    private final RateLimiter rateLimiter;

    @Override
    @Transactional
    public Session register(RegisterRequest req, String timezoneHeader, String userAgent) {
        String email = normalizeEmail(req.email());
        if (users.existsByEmail(email)) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "An account with this email already exists.");
        }
        User user = users.saveAndFlush(User.builder()
                .email(email)
                .name(req.name().trim())
                .passwordHash(passwordEncoder.encode(req.password()))
                .role(props.adminEmailList().contains(email) ? Role.ADMIN : Role.USER)
                .build());
        UserSettings settings = UserSettings.builder().user(user).build();
        if (validZone(timezoneHeader)) settings.setTimezone(timezoneHeader);
        settingsRepo.save(settings);
        return issue(user, settings, UUID.randomUUID(), userAgent);
    }

    @Override
    @Transactional
    public Session login(LoginRequest req, String userAgent) {
        String email = normalizeEmail(req.email());
        rateLimiter.check("auth.login.email", email);
        User user = users.findByEmail(email).orElse(null);
        String hash = user == null ? dummyHash() : user.getPasswordHash();
        boolean matches = passwordEncoder.matches(req.password(), hash);
        if (user == null || !matches || !user.isEnabled()) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Incorrect email or password.");
        }
        return issue(user, settingsOf(user), UUID.randomUUID(), userAgent);
    }

    @Override
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String raw, String userAgent) {
        if (raw == null || raw.isBlank()) throw refreshInvalid();
        RefreshToken t = tokens.findForUpdate(Hashing.sha256Hex(raw)).orElseThrow(AuthServiceImpl::refreshInvalid);
        Instant now = Instant.now();
        if (t.getUsedAt() != null) {
            // A rotated token came back: assume theft and end every session of this login.
            tokens.revokeFamily(t.getFamilyId(), now);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_REUSED", "Your session ended. Please log in again.");
        }
        if (t.getRevokedAt() != null || t.getExpiresAt().isBefore(now)) throw refreshInvalid();
        User user = users.findById(t.getUserId()).filter(User::isEnabled).orElseThrow(AuthServiceImpl::refreshInvalid);
        t.setUsedAt(now);
        return issue(user, settingsOf(user), t.getFamilyId(), userAgent);
    }

    @Override
    @Transactional
    public void logout(String raw) {
        if (raw == null || raw.isBlank()) return;
        tokens.findByTokenHash(Hashing.sha256Hex(raw))
                .ifPresent(t -> tokens.revokeFamily(t.getFamilyId(), Instant.now()));
    }

    @Override
    @Transactional(readOnly = true)
    public MeResponse me(UUID userId) {
        User user = users.findById(userId).orElseThrow(ApiException::unauthenticated);
        return new MeResponse(mapper.toDto(user), mapper.toDto(settingsOf(user), null));
    }

    private Session issue(User user, UserSettings settings, UUID familyId, String userAgent) {
        JwtService.Issued access = jwtService.create(user.getId(), user.getRole());
        String raw = Hashing.randomToken();
        tokens.save(RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(Hashing.sha256Hex(raw))
                .familyId(familyId)
                .expiresAt(Instant.now().plus(Duration.ofDays(props.jwt().refreshDays())))
                .userAgent(userAgent == null ? null : userAgent.substring(0, Math.min(255, userAgent.length())))
                .build());
        AuthResponse body = new AuthResponse(mapper.toDto(user), mapper.toDto(settings, null),
                access.token(), access.expiresAt());
        return new Session(body, raw);
    }

    private String dummyHash() {
        String h = dummyHash;
        if (h == null) {
            h = passwordEncoder.encode(Hashing.randomToken());
            dummyHash = h;
        }
        return h;
    }

    private UserSettings settingsOf(User user) {
        return settingsRepo.findById(user.getId())
                .orElseGet(() -> settingsRepo.save(UserSettings.builder().user(user).build()));
    }

    private static ApiException refreshInvalid() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "REFRESH_INVALID", "Your session ended. Please log in again.");
    }

    static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    static boolean validZone(String zone) {
        if (zone == null || zone.isBlank() || zone.length() > 64) return false;
        try {
            ZoneId.of(zone);
            return zone.contains("/") || "UTC".equals(zone);
        } catch (DateTimeException e) {
            return false;
        }
    }
}
