package com.learnai.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.learnai.exception.ApiException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/** In-memory Bucket4j buckets per (bucket name, key); idle buckets expire after 2 h (BACKEND.md §5.6). */
@Component
public class RateLimiter {

    private static Bandwidth per(long n, Duration d) {
        return Bandwidth.builder().capacity(n).refillGreedy(n, d).build();
    }

    private static final Map<String, List<Bandwidth>> BUCKETS = Map.ofEntries(
            Map.entry("auth.login.ip", List.of(per(10, Duration.ofMinutes(1)))),
            Map.entry("auth.login.email", List.of(per(20, Duration.ofHours(1)))),
            Map.entry("auth.register.ip", List.of(per(5, Duration.ofHours(1)))),
            Map.entry("harness.create", List.of(per(20, Duration.ofMinutes(1)), per(400, Duration.ofDays(1)))),
            Map.entry("harness.complete", List.of(per(40, Duration.ofMinutes(1)))),
            Map.entry("documents.upload", List.of(per(20, Duration.ofHours(1)))),
            Map.entry("images.generate", List.of(per(10, Duration.ofHours(1)))),
            Map.entry("messages.translate", List.of(per(60, Duration.ofHours(1)))),
            Map.entry("voice.token", List.of(per(30, Duration.ofHours(1)))),
            Map.entry("evals.create", List.of(per(10, Duration.ofDays(1)))));

    private final Cache<String, Bucket> cache = Caffeine.newBuilder()
            .expireAfterAccess(Duration.ofHours(2))
            .maximumSize(100_000)
            .build();

    /** Consumes one token or throws 429 RATE_LIMITED with Retry-After. */
    public void check(String bucketName, String key) {
        List<Bandwidth> limits = BUCKETS.get(bucketName);
        if (limits == null) throw new IllegalArgumentException("Unknown rate-limit bucket " + bucketName);
        Bucket bucket = cache.get(bucketName + "|" + key, k -> {
            var b = Bucket.builder();
            limits.forEach(b::addLimit);
            return b.build();
        });
        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);
        if (!probe.isConsumed()) {
            long retry = Math.max(1, Duration.ofNanos(probe.getNanosToWaitForRefill()).toSeconds());
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                    "Too many requests. Please wait a moment and try again.",
                    Map.of("retryAfterSeconds", retry), Map.of("Retry-After", Long.toString(retry)));
        }
    }
}
