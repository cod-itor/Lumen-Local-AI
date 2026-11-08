package com.learnai.jobs;

import com.learnai.repository.DocumentRepository;
import com.learnai.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

/** Claims queued jobs every second and runs them on virtual threads, max 4 ingests at once (BACKEND.md §9.1). */
@Slf4j
@Component
@RequiredArgsConstructor
public class JobRunner {

    private final JobRepository jobs;
    private final DocumentRepository documents;
    private final IngestJobHandler ingest;
    private final TransactionTemplate tx;
    private final Semaphore ingestSlots = new Semaphore(4);
    private final ExecutorService jobExecutor =
            Executors.newThreadPerTaskExecutor(Thread.ofVirtual().name("job-", 0).factory());

    @EventListener(ApplicationReadyEvent.class)
    public void failInterrupted() {
        List<UUID> ids = tx.execute(s -> jobs.failInterrupted());
        if (ids == null || ids.isEmpty()) return;
        log.warn("{} job(s) were interrupted by a restart", ids.size());
        for (UUID id : ids) {
            jobs.findById(id).ifPresent(j -> {
                String doc = j.getPayload().path("documentId").asString(null);
                if (doc != null) {
                    tx.executeWithoutResult(s -> documents.failIfOpen(UUID.fromString(doc),
                            "Indexing was interrupted. Please upload the file again."));
                }
            });
        }
    }

    @Scheduled(fixedDelay = 1000, initialDelay = 2000)
    public void poll() {
        int free = ingestSlots.availablePermits();
        if (free == 0) return;
        List<UUID> claimed = tx.execute(s -> jobs.claim(List.of("INGEST"), free));
        if (claimed == null) return;
        for (UUID id : claimed) {
            ingestSlots.acquireUninterruptibly();
            jobExecutor.submit(() -> {
                try {
                    ingest.run(id);
                } catch (RuntimeException e) {
                    log.error("job {} crashed", id, e);
                } finally {
                    ingestSlots.release();
                }
            });
        }
    }
}
