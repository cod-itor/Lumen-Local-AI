package com.learnai.harness;

import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/** Safe writes to one SSE stream (API_CONTRACT §5): never throws into the runner; heartbeat every 15 s. */
@Slf4j
public class SseWriter {

    private final SseEmitter emitter;
    private final ObjectMapper json;
    private final AtomicBoolean closed = new AtomicBoolean(false);
    private final ScheduledFuture<?> ping;
    private volatile Runnable onDisconnect = () -> {};

    public SseWriter(SseEmitter emitter, ObjectMapper json, ScheduledExecutorService scheduler) {
        this.emitter = emitter;
        this.json = json;
        this.ping = scheduler.scheduleAtFixedRate(this::heartbeat, 15, 15, TimeUnit.SECONDS);
        emitter.onCompletion(this::disconnected);
        emitter.onTimeout(this::disconnected);
        emitter.onError(e -> disconnected());
    }

    public void onDisconnect(Runnable r) {
        this.onDisconnect = r;
    }

    public boolean isOpen() {
        return !closed.get();
    }

    public synchronized void send(String event, Object data) {
        if (closed.get()) return;
        try {
            emitter.send(SseEmitter.event().name(event).data(json.writeValueAsString(data)));
        } catch (IOException | IllegalStateException e) {
            log.debug("SSE client gone: {}", e.getMessage());
            disconnected();
        }
    }

    /** Send a terminal event and close the stream. */
    public synchronized void finish(String event, Object data) {
        send(event, data);
        complete();
    }

    public synchronized void complete() {
        if (closed.compareAndSet(false, true)) {
            ping.cancel(false);
            try {
                emitter.complete();
            } catch (IllegalStateException ignored) {
                // already completed
            }
        }
    }

    private synchronized void heartbeat() {
        if (closed.get()) return;
        try {
            emitter.send(SseEmitter.event().comment("ping"));
        } catch (IOException | IllegalStateException e) {
            disconnected();
        }
    }

    private void disconnected() {
        if (closed.compareAndSet(false, true)) {
            ping.cancel(false);
            try { // end the response too, so a client that is still there never waits for the async timeout
                emitter.complete();
            } catch (IllegalStateException ignored) {
                // already completed
            }
            onDisconnect.run();
        }
    }
}
