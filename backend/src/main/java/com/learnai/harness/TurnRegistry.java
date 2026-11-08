package com.learnai.harness;

import org.springframework.stereotype.Component;
import reactor.core.publisher.Sinks;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/** Running turns: cancel signal, partial text length and the open stream (BACKEND.md §2 TurnRegistry). */
@Component
public class TurnRegistry {

    public static final class Handle {
        public final Sinks.Empty<Void> cancel = Sinks.empty();
        public final AtomicBoolean cancelRequested = new AtomicBoolean(false);
        public final AtomicInteger partialChars = new AtomicInteger(0);
        public volatile SseWriter writer;

        public void requestCancel() {
            if (cancelRequested.compareAndSet(false, true)) cancel.tryEmitEmpty();
        }
    }

    private final Map<UUID, Handle> running = new ConcurrentHashMap<>();

    public Handle register(UUID turnId, SseWriter writer) {
        Handle h = running.computeIfAbsent(turnId, k -> new Handle());
        h.writer = writer;
        return h;
    }

    public Optional<Handle> get(UUID turnId) {
        return Optional.ofNullable(running.get(turnId));
    }

    public void remove(UUID turnId) {
        running.remove(turnId);
    }
}
