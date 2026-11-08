package com.learnai.voice;

import com.learnai.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.util.UriComponentsBuilder;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

/**
 * BACKEND §9.8: /ws/voice relay. One-time token → one connection per user → a WebSocket to the AI service's
 * /voice/stream (X-Internal-Token). Frames are forwarded unchanged both ways; 5-minute connection limit.
 */
@Slf4j
@Component
public class VoiceWebSocketHandler extends AbstractWebSocketHandler {

    private static final Duration MAX_CONNECTION = Duration.ofMinutes(5);
    private static final int MAX_BINARY = 64 * 1024;

    private final VoiceTokens tokens;
    private final AppProperties props;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ScheduledExecutorService timers = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "voice-timer");
        t.setDaemon(true);
        return t;
    });
    private final Map<UUID, String> activeUsers = new ConcurrentHashMap<>();
    private final Map<String, Relay> relays = new ConcurrentHashMap<>();

    public VoiceWebSocketHandler(VoiceTokens tokens, AppProperties props) {
        this.tokens = tokens;
        this.props = props;
    }

    /** One client connection and its upstream; sends to the AI are chained (java.net.http allows one at a time). */
    private static final class Relay {
        final UUID userId;
        final WebSocketSession client;
        volatile CompletableFuture<WebSocket> upstream;
        volatile ScheduledFuture<?> timer;

        Relay(UUID userId, WebSocketSession client) {
            this.userId = userId;
            this.client = client;
        }

        synchronized void send(java.util.function.Function<WebSocket, CompletableFuture<WebSocket>> op) {
            upstream = upstream.thenCompose(op);
        }
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession raw) throws IOException {
        URI uri = raw.getUri();
        String token = uri == null ? null
                : UriComponentsBuilder.fromUri(uri).build().getQueryParams().getFirst("token");
        UUID userId = tokens.consume(token);
        if (userId == null) {
            raw.close(CloseStatus.POLICY_VIOLATION.withReason("Invalid or expired voice token"));
            return;
        }
        if (activeUsers.putIfAbsent(userId, raw.getId()) != null) {
            raw.close(CloseStatus.POLICY_VIOLATION.withReason("Voice is already open in another tab"));
            return;
        }
        raw.setBinaryMessageSizeLimit(MAX_BINARY);
        WebSocketSession client = new ConcurrentWebSocketSessionDecorator(raw, 5000, 256 * 1024);
        Relay relay = new Relay(userId, client);
        relays.put(raw.getId(), relay);
        relay.timer = timers.schedule(() -> closeQuietly(client, CloseStatus.POLICY_VIOLATION.withReason("Time limit")),
                MAX_CONNECTION.toSeconds(), TimeUnit.SECONDS);
        String base = props.aiService().wsUrl() == null ? "ws://localhost:8001" : props.aiService().wsUrl();
        relay.upstream = http.newWebSocketBuilder()
                .header("X-Internal-Token", props.aiService().token() == null ? "" : props.aiService().token())
                .connectTimeout(Duration.ofSeconds(5))
                .buildAsync(URI.create(base.replaceAll("/+$", "") + "/voice/stream"), new Upstream(client))
                .whenComplete((ws, err) -> {
                    if (err != null) {
                        log.warn("voice relay: AI service not reachable: {}", err.toString());
                        sendError(client, "INTERNAL_ERROR", "Voice is not available right now.");
                        closeQuietly(client, CloseStatus.SERVER_ERROR);
                    }
                });
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Relay r = relays.get(session.getId());
        if (r != null) r.send(ws -> ws.sendText(message.getPayload(), true));
    }

    @Override
    protected void handleBinaryMessage(WebSocketSession session, BinaryMessage message) {
        Relay r = relays.get(session.getId());
        if (r == null) return;
        ByteBuffer copy = ByteBuffer.allocate(message.getPayloadLength()).put(message.getPayload()).flip();
        r.send(ws -> ws.sendBinary(copy, true));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Relay r = relays.remove(session.getId());
        if (r == null) return;
        activeUsers.remove(r.userId, session.getId());
        if (r.timer != null) r.timer.cancel(false);
        r.upstream.thenAccept(ws -> ws.sendClose(WebSocket.NORMAL_CLOSURE, "client closed"))
                .exceptionally(e -> null);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("voice client transport error: {}", exception.toString());
    }

    /** AI → client: text frames (ready/partial/final/error) are forwarded; upstream close closes the client. */
    private final class Upstream implements WebSocket.Listener {
        private final WebSocketSession client;
        private final StringBuilder buf = new StringBuilder();

        Upstream(WebSocketSession client) {
            this.client = client;
        }

        @Override
        public CompletionStage<?> onText(WebSocket ws, CharSequence data, boolean last) {
            buf.append(data);
            if (last) {
                String msg = buf.toString();
                buf.setLength(0);
                try {
                    if (client.isOpen()) client.sendMessage(new TextMessage(msg));
                } catch (IOException | IllegalStateException e) {
                    log.debug("voice relay: client send failed: {}", e.toString());
                }
            }
            ws.request(1);
            return null;
        }

        @Override
        public CompletionStage<?> onClose(WebSocket ws, int statusCode, String reason) {
            CloseStatus cs = statusCode == 1008 ? CloseStatus.POLICY_VIOLATION.withReason(reason) : CloseStatus.NORMAL;
            closeQuietly(client, cs);
            return null;
        }

        @Override
        public void onError(WebSocket ws, Throwable error) {
            log.warn("voice relay: AI stream error: {}", error.toString());
            closeQuietly(client, CloseStatus.SERVER_ERROR);
        }
    }

    private static void sendError(WebSocketSession s, String code, String message) {
        try {
            if (s.isOpen()) {
                s.sendMessage(new TextMessage("{\"type\":\"error\",\"code\":\"" + code + "\",\"message\":\"" + message + "\"}"));
            }
        } catch (IOException | IllegalStateException ignored) {
            // the client is gone
        }
    }

    private static void closeQuietly(WebSocketSession s, CloseStatus status) {
        try {
            if (s.isOpen()) s.close(status);
        } catch (IOException ignored) {
            // already closed
        }
    }
}
