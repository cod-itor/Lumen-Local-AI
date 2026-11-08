package com.learnai.jobs;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.function.BiConsumer;

/** In-memory pub/sub of job events for `GET /api/jobs/{id}/events` (BACKEND.md §9.1). */
@Component
public class JobEventBus {

    private final Map<UUID, Set<BiConsumer<String, Object>>> listeners = new ConcurrentHashMap<>();

    public Runnable subscribe(UUID jobId, BiConsumer<String, Object> l) {
        listeners.computeIfAbsent(jobId, k -> new CopyOnWriteArraySet<>()).add(l);
        return () -> {
            var set = listeners.get(jobId);
            if (set != null) {
                set.remove(l);
                if (set.isEmpty()) listeners.remove(jobId, set);
            }
        };
    }

    public void publish(UUID jobId, String event, Object data) {
        var set = listeners.get(jobId);
        if (set == null) return;
        for (var l : set) {
            try {
                l.accept(event, data);
            } catch (RuntimeException ignored) {
                // a broken subscriber must not stop the job
            }
        }
    }
}
