package com.learnai.security;

import com.learnai.config.AppProperties;
import com.learnai.entity.enums.Role;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.UUID;

/** HS256 access tokens (BACKEND.md §5.2). */
@Service
public class JwtService {

    private final SecretKey key;
    private final Duration lifetime;

    public JwtService(AppProperties props) {
        this.key = Keys.hmacShaKeyFor(props.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.lifetime = Duration.ofMinutes(props.jwt().accessMinutes());
    }

    public record Issued(String token, Instant expiresAt) {}

    public Issued create(UUID userId, Role role) {
        Instant now = Instant.now();
        Instant exp = now.plus(lifetime);
        String token = Jwts.builder()
                .subject(userId.toString())
                .claim("role", role.name())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(exp))
                .signWith(key)
                .compact();
        return new Issued(token, exp);
    }

    public Optional<CurrentUser> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).clockSkewSeconds(30).build()
                    .parseSignedClaims(token).getPayload();
            return Optional.of(new CurrentUser(UUID.fromString(c.getSubject()), Role.valueOf(c.get("role", String.class))));
        } catch (JwtException | IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }

    public long lifetimeSeconds() {
        return lifetime.toSeconds();
    }
}
