package com.learnai.voice;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/** BACKEND §9.8: single-use 60-second tokens that authenticate the /ws/voice handshake. */
@Component
public class VoiceTokens {

    public static final Duration TTL = Duration.ofSeconds(60);

    private final SecureRandom random = new SecureRandom();
    private final Cache<String, UUID> tokens = Caffeine.newBuilder().expireAfterWrite(TTL).maximumSize(10_000).build();

    public record Issued(String token, Instant expiresAt) {}

    public Issued issue(UUID userId) {
        byte[] b = new byte[32];
        random.nextBytes(b);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(b);
        tokens.put(token, userId);
        return new Issued(token, Instant.now().plus(TTL));
    }

    /** The user the token was issued to, or null; the token is removed either way. */
    public UUID consume(String token) {
        if (token == null || token.isBlank()) return null;
        return tokens.asMap().remove(token);
    }
}
