package com.learnai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;

/** Executors (BACKEND.md §2): one virtual thread per turn, plus a small scheduler for SSE heartbeats. */
@Configuration
public class AsyncConfig {

    @Bean(destroyMethod = "shutdownNow")
    public ExecutorService turnExecutor() {
        return Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("turn-", 0).factory());
    }

    @Bean(destroyMethod = "shutdownNow")
    public ScheduledExecutorService sseHeartbeat() {
        return Executors.newSingleThreadScheduledExecutor(Thread.ofPlatform().daemon().name("sse-ping").factory());
    }
}
