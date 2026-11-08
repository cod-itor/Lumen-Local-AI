package com.learnai.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Typed {@code app.*} configuration (BACKEND.md §4). Fails fast on startup when invalid. */
@Validated
@ConfigurationProperties("app")
public record AppProperties(
        @NotBlank String publicUrl,
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull AiService aiService,
        @NotBlank String storageDir,
        @Min(1) int maxUploadMb,
        @Min(1) int userStorageQuotaMb,
        @Valid @NotNull Harness harness,
        String adminEmails) {

    public AppProperties {
        if (jwt.secret() == null || jwt.secret().getBytes().length < 32) {
            throw new IllegalStateException("JWT_SECRET must be at least 32 bytes");
        }
        try {
            URI uri = URI.create(publicUrl);
            if (uri.getScheme() == null || uri.getHost() == null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("PUBLIC_URL must be a valid URL", e);
        }
    }

    public record Jwt(@NotBlank String secret, @Min(1) int accessMinutes, @Min(1) int refreshDays) {}

    public record AiService(@NotBlank String url, String wsUrl, String token, int connectTimeoutMs,
                            int prepareTimeoutS, int generateIdleTimeoutS, int finalizeTimeoutS, int jobTimeoutS) {}

    public record Harness(int turnTtlMinutes, int maxCompletionKb, boolean remoteUrlEnabled,
                          boolean forceStrictProfile, String providerKeySecret) {}

    /** Origin (scheme://host[:port]) of the public site, for the CSRF origin check. */
    public String publicOrigin() {
        URI uri = URI.create(publicUrl);
        int port = uri.getPort();
        return uri.getScheme() + "://" + uri.getHost() + (port == -1 ? "" : ":" + port);
    }

    public boolean secureCookies() {
        return publicUrl.toLowerCase(Locale.ROOT).startsWith("https");
    }

    public List<String> adminEmailList() {
        if (adminEmails == null || adminEmails.isBlank()) return List.of();
        return Arrays.stream(adminEmails.split(","))
                .map(s -> s.trim().toLowerCase(Locale.ROOT))
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
