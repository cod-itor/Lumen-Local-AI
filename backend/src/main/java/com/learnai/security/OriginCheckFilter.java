package com.learnai.security;

import com.learnai.config.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.Set;

/**
 * CSRF protection (BACKEND.md §5.4): state-changing requests that carry an auth cookie must come from
 * {@code PUBLIC_URL}'s origin. Bearer-only requests (Swagger, scripts) are exempt.
 */
@Component
@RequiredArgsConstructor
public class OriginCheckFilter extends OncePerRequestFilter {

    private static final Set<String> UNSAFE = Set.of("POST", "PUT", "PATCH", "DELETE");

    private final AppProperties props;
    private final ErrorWriter errorWriter;

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if (UNSAFE.contains(req.getMethod()) && hasAuthCookie(req) && !props.publicOrigin().equalsIgnoreCase(origin(req))) {
            errorWriter.write(req, res, HttpStatus.FORBIDDEN, "FORBIDDEN_ORIGIN", "This request came from another site.");
            return;
        }
        chain.doFilter(req, res);
    }

    private static boolean hasAuthCookie(HttpServletRequest req) {
        return CookieService.read(req, CookieService.ACCESS).isPresent()
                || CookieService.read(req, CookieService.REFRESH).isPresent();
    }

    private static String origin(HttpServletRequest req) {
        String origin = req.getHeader("Origin");
        if (origin != null && !origin.isBlank() && !"null".equals(origin)) return origin;
        String referer = req.getHeader("Referer");
        if (referer == null) return null;
        try {
            URI u = URI.create(referer);
            return u.getScheme() + "://" + u.getHost() + (u.getPort() == -1 ? "" : ":" + u.getPort());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
