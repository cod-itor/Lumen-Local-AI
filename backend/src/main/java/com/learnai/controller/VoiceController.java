package com.learnai.controller;

import com.learnai.client.AiServiceClient;
import com.learnai.exception.ApiException;
import com.learnai.ratelimit.RateLimit;
import com.learnai.security.CurrentUser;
import com.learnai.voice.VoiceTokens;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** API_CONTRACT §6.8. The stream itself is {@link com.learnai.voice.VoiceWebSocketHandler}. */
@RestController
@RequiredArgsConstructor
public class VoiceController {

    private final VoiceTokens tokens;
    private final AiServiceClient ai;

    public record TtsRequest(@NotBlank @Size(max = 1000) String text, @NotNull @Pattern(regexp = "EN|KM") String lang) {}

    @RateLimit("voice.token")
    @PostMapping("/api/voice/token")
    public VoiceTokens.Issued token(@AuthenticationPrincipal CurrentUser user) {
        if (!ai.capabilities().path("features").path("voice").asBoolean(false)) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE", "Voice input is not installed on this server.");
        }
        return tokens.issue(user.id());
    }

    @PostMapping("/api/voice/tts")
    public ResponseEntity<byte[]> tts(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody TtsRequest body) {
        if (!ai.capabilities().path("features").path("tts").asBoolean(false)) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE", "Read aloud is not installed on this server.");
        }
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("audio/wav")).body(ai.tts(body.text(), body.lang()));
    }
}
