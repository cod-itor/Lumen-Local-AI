package com.learnai.jobs;

import com.learnai.dto.response.JobDto;
import com.learnai.entity.Job;
import com.learnai.entity.enums.JobStatus;
import com.learnai.entity.enums.JobType;
import com.learnai.exception.ApiException;
import com.learnai.harness.SseWriter;
import com.learnai.repository.DocumentRepository;
import com.learnai.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;

/** Job reads, event streams and cancel (API_CONTRACT §5.2, §6.6). */
@Service
@RequiredArgsConstructor
public class JobService {

    public static final String UPLOAD_CANCELLED = "Upload cancelled.";

    private final JobRepository jobs;
    private final DocumentRepository documents;
    private final JobEventBus bus;
    private final ObjectMapper json;
    private final ScheduledExecutorService sseHeartbeat;
    private final TransactionTemplate tx;
    /** Running jobs asked to stop; the handler checks this and disposes the AI stream. */
    final Set<UUID> cancelRequested = ConcurrentHashMap.newKeySet();

    public Job own(UUID userId, UUID id) {
        return jobs.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("job"));
    }

    public JobDto get(UUID userId, UUID id) {
        return toDto(own(userId, id));
    }

    public SseEmitter events(UUID userId, UUID id) {
        own(userId, id);
        SseEmitter emitter = new SseEmitter(0L);
        SseWriter w = new SseWriter(emitter, json, sseHeartbeat);
        Runnable unsubscribe = bus.subscribe(id, (event, data) -> {
            if ("progress".equals(event)) w.send(event, data);
            else w.finish(event, data);
        });
        w.onDisconnect(unsubscribe);
        // Subscribe first, then read: a job that finished in between still reaches the client.
        Job j = jobs.findById(id).orElseThrow();
        if (j.getStatus().isTerminal()) {
            unsubscribe.run();
            terminal(j, w);
        }
        return emitter;
    }

    void terminal(Job j, SseWriter w) {
        if (j.getStatus() == JobStatus.SUCCEEDED) {
            w.finish("done", toDto(j));
        } else {
            String code = j.getStatus() == JobStatus.CANCELLED ? "CANCELLED" : errorCode(j);
            w.finish("error", Map.of("code", code, "message", j.getError() == null ? "The job failed." : j.getError(),
                    "retryable", "AI_SERVICE_UNAVAILABLE".equals(code) || "AI_TIMEOUT".equals(code)));
        }
    }

    private static String errorCode(Job j) {
        return j.getResult() != null && j.getResult().path("errorCode").isString()
                ? j.getResult().path("errorCode").asString() : "INTERNAL_ERROR";
    }

    public JobDto cancel(UUID userId, UUID id) {
        Job j = own(userId, id);
        if (j.getStatus().isTerminal()) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This job already finished.");
        }
        if (j.getStatus() == JobStatus.QUEUED) {
            int n = tx.execute(s -> jobs.finishIfOpen(id, JobStatus.CANCELLED.name(), UPLOAD_CANCELLED));
            if (n > 0) {
                failDocument(j, UPLOAD_CANCELLED);
                Job done = jobs.findById(id).orElseThrow();
                bus.publish(id, "error", Map.of("code", "CANCELLED", "message", UPLOAD_CANCELLED, "retryable", false));
                return toDto(done);
            }
        }
        cancelRequested.add(id);
        return toDto(jobs.findById(id).orElseThrow());
    }

    void failDocument(Job j, String error) {
        if (j.getType() != JobType.INGEST) return;
        String doc = j.getPayload().path("documentId").asString(null);
        if (doc != null) tx.executeWithoutResult(s -> documents.failIfOpen(UUID.fromString(doc), error));
    }

    public JobDto toDto(Job j) {
        return new JobDto(j.getId(), j.getType(), j.getStatus(), j.getProgress(), j.getStage(), j.getResult(),
                j.getError(), j.getCreatedAt(), j.getUpdatedAt());
    }
}
