package com.learnai.security;

import com.learnai.config.AppProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.Optional;

/** Auth cookies (API_CONTRACT §2, BACKEND.md §5.5). */
@Service
@RequiredArgsConstructor
public class CookieService {

    public static final String ACCESS = "access_token";
    public static final String REFRESH = "refresh_token";
    public static final String HINT = "session_hint";
    private static final String REFRESH_PATH = "/api/auth";

    private final AppProperties props;

    public void writeSession(HttpServletResponse res, String accessToken, String refreshToken) {
        Duration refreshAge = Duration.ofDays(props.jwt().refreshDays());
        add(res, cookie(ACCESS, accessToken, "/", Duration.ofMinutes(props.jwt().accessMinutes())));
        add(res, cookie(REFRESH, refreshToken, REFRESH_PATH, refreshAge));
        add(res, cookie(HINT, "1", "/", refreshAge));
    }

    public void clearSession(HttpServletResponse res) {
        add(res, cookie(ACCESS, "", "/", Duration.ZERO));
        add(res, cookie(REFRESH, "", REFRESH_PATH, Duration.ZERO));
        add(res, cookie(HINT, "", "/", Duration.ZERO));
    }

    public static Optional<String> read(HttpServletRequest req, String name) {
        Cookie[] cookies = req.getCookies();
        if (cookies == null) return Optional.empty();
        for (Cookie c : cookies) {
            if (name.equals(c.getName()) && c.getValue() != null && !c.getValue().isBlank()) {
                return Optional.of(c.getValue());
            }
        }
        return Optional.empty();
    }

    private ResponseCookie cookie(String name, String value, String path, Duration maxAge) {
        return ResponseCookie.from(name, value)
                .httpOnly(true)
                .secure(props.secureCookies())
                .sameSite("Lax")
                .path(path)
                .maxAge(maxAge)
                .build();
    }

    private static void add(HttpServletResponse res, ResponseCookie c) {
        res.addHeader(HttpHeaders.SET_COOKIE, c.toString());
    }
}
