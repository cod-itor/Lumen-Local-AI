package com.learnai.config;

import com.learnai.voice.VoiceWebSocketHandler;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/** Registers the voice relay at /ws/voice; only the public site's origin may open it (BACKEND §9.8). */
@Configuration
@EnableWebSocket
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketConfigurer {

    private final VoiceWebSocketHandler voice;
    private final AppProperties props;

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(voice, "/ws/voice").setAllowedOrigins(props.publicOrigin());
    }
}
