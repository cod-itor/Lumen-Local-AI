package com.learnai.ratelimit;

import com.learnai.security.CurrentUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

/** Applies {@link RateLimit} buckets before the controller runs. */
@Component
@RequiredArgsConstructor
public class RateLimitInterceptor implements HandlerInterceptor {

    private final RateLimiter rateLimiter;

    @Override
    public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
        if (!(handler instanceof HandlerMethod hm)) return true;
        RateLimit rl = hm.getMethodAnnotation(RateLimit.class);
        if (rl == null) return true;
        for (String name : rl.value()) {
            rateLimiter.check(name, name.endsWith(".ip") ? req.getRemoteAddr() : userKey(req));
        }
        return true;
    }

    private static String userKey(HttpServletRequest req) {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a != null && a.getPrincipal() instanceof CurrentUser u) return u.id().toString();
        return req.getRemoteAddr();
    }
}
