package com.learnai.jobs;

import com.learnai.client.AiEvent;
import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.entity.Document;
import com.learnai.entity.Job;
import com.learnai.entity.enums.DocumentStatus;
import com.learnai.entity.enums.JobStatus;
import com.learnai.repository.DocumentRepository;
import com.learnai.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

/** INGEST job: AI `/rag/ingest` → document status and job progress (BACKEND.md §9.2). */
@Slf4j
@Component
@RequiredArgsConstructor
public class IngestJobHandler {

    private static final Map<String, String> MESSAGES = Map.of(
            "SCANNED_PDF", "Could not read this PDF (it may be scanned images only).",
            "EMPTY_DOCUMENT", "This document has no text.",
            "TOO_MANY_PAGES", "This document has more than 300 pages.",
            "PARSE_FAILED", "Could not read this file.",
            "EMBED_FAILED", "Could not index this document. Check that the embedding model is installed in Ollama.");

    private final AiServiceClient ai;
    private final JobRepository jobs;
    private final DocumentRepository documents;
    private final JobService jobService;
    private final JobEventBus bus;
    private final TransactionTemplate tx;
    private final ObjectMapper json;

    public void run(UUID jobId) {
        Job job = jobs.findById(jobId).orElseThrow();
        UUID docId = UUID.fromString(job.getPayload().path("documentId").asString());
        Document doc = documents.findById(docId).orElse(null);
        if (doc == null) {
            finish(job, JobStatus.FAILED, "INTERNAL_ERROR", "The document was deleted.", null);
            return;
        }
        setDocStatus(docId, DocumentStatus.PARSING);
        var req = json.createObjectNode().put("documentId", docId.toString()).put("userId", doc.getUserId().toString())
                .put("path", doc.getStoragePath()).put("mime", doc.getMime()).put("filename", doc.getFilename());
        var cancelled = Flux.interval(Duration.ofMillis(500)).filter(t -> jobService.cancelRequested.contains(jobId)).next();
        long lastWrite = 0;
        boolean terminal = false;
        try {
            for (AiEvent ev : ai.ingest(req).takeUntilOther(cancelled).toIterable()) {
                JsonNode d = ev.data();
                switch (ev.name()) {
                    case "progress" -> {
                        String stage = d.path("stage").asString("PARSING");
                        float p = progress(stage, d.path("current").asInt(0), Math.max(1, d.path("total").asInt(1)));
                        bus.publish(jobId, "progress", Map.of("progress", p, "stage", stage));
                        if (System.currentTimeMillis() - lastWrite > 1000) {
                            lastWrite = System.currentTimeMillis();
                            tx.executeWithoutResult(s -> jobs.progress(jobId, p, stage));
                            if (!"PARSING".equals(stage)) setDocStatus(docId, DocumentStatus.EMBEDDING);
                        }
                    }
                    case "done" -> {
                        terminal = true;
                        tx.executeWithoutResult(s -> documents.findById(docId).ifPresent(x -> {
                            x.setStatus(DocumentStatus.READY);
                            x.setError(null);
                            x.setPages(d.path("pages").isNumber() ? d.path("pages").asInt() : null);
                            x.setChunkCount(d.path("chunkCount").asInt(0));
                            x.setLanguage(d.path("language").asString(null));
                        }));
                        tx.executeWithoutResult(s -> jobs.progress(jobId, 1f, "DONE"));
                        finish(job, JobStatus.SUCCEEDED, null, null, d);
                    }
                    case "error" -> {
                        terminal = true;
                        String code = d.path("code").asString("INTERNAL_ERROR");
                        String msg = MESSAGES.getOrDefault(code, d.path("message").asString("Could not read this file."));
                        jobService.failDocument(job, msg);
                        finish(job, JobStatus.FAILED, code, msg, null);
                    }
                    default -> log.debug("ignoring ingest event {}", ev.name());
                }
                if (terminal) break;
            }
            if (!terminal && jobService.cancelRequested.contains(jobId)) {
                jobService.failDocument(job, JobService.UPLOAD_CANCELLED);
                try {
                    ai.deleteDocumentChunks(docId);
                } catch (AiServiceException ignored) {
                    // chunks are written in one transaction at the end, so there is usually nothing to delete
                }
                finish(job, JobStatus.CANCELLED, "CANCELLED", JobService.UPLOAD_CANCELLED, null);
            } else if (!terminal) {
                jobService.failDocument(job, "Indexing stopped unexpectedly.");
                finish(job, JobStatus.FAILED, "INTERNAL_ERROR", "Indexing stopped unexpectedly.", null);
            }
        } catch (AiServiceException e) {
            jobService.failDocument(job, e.getMessage());
            finish(job, JobStatus.FAILED, e.getCode(), e.getMessage(), null);
        } catch (RuntimeException e) {
            log.error("ingest job {} failed", jobId, e);
            jobService.failDocument(job, "Indexing failed.");
            finish(job, JobStatus.FAILED, "INTERNAL_ERROR", "Indexing failed.", null);
        } finally {
            jobService.cancelRequested.remove(jobId);
        }
    }

    private static float progress(String stage, int current, int total) {
        float f = Math.min(1f, (float) current / total);
        return switch (stage) {
            case "PARSING" -> 0.1f * f;
            case "TRANSLATING" -> 0.1f + 0.2f * f;
            case "EMBEDDING" -> 0.3f + 0.65f * f;
            default -> 0.97f;
        };
    }

    private void setDocStatus(UUID id, DocumentStatus st) {
        tx.executeWithoutResult(s -> documents.findById(id).ifPresent(x -> {
            if (x.getStatus() != DocumentStatus.READY && x.getStatus() != DocumentStatus.FAILED) x.setStatus(st);
        }));
    }

    private void finish(Job job, JobStatus status, String code, String error, JsonNode result) {
        tx.executeWithoutResult(s -> jobs.findById(job.getId()).ifPresent(j -> {
            if (j.getStatus().isTerminal()) return;
            j.setStatus(status);
            j.setError(error);
            j.setFinishedAt(java.time.Instant.now());
            if (status == JobStatus.SUCCEEDED) j.setProgress(1f);
            j.setResult(result != null ? result : code == null ? null : json.createObjectNode().put("errorCode", code));
        }));
        Job done = jobs.findById(job.getId()).orElseThrow();
        if (status == JobStatus.SUCCEEDED) {
            bus.publish(job.getId(), "done", jobService.toDto(done));
        } else {
            bus.publish(job.getId(), "error", Map.of("code", code == null ? "INTERNAL_ERROR" : code,
                    "message", error == null ? "The job failed." : error,
                    "retryable", "AI_SERVICE_UNAVAILABLE".equals(code) || "AI_TIMEOUT".equals(code)));
        }
    }
}
