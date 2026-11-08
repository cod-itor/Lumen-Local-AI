package com.learnai.jobs;

import com.learnai.client.AiEvent;
import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.entity.Image;
import com.learnai.entity.Job;
import com.learnai.entity.enums.ImageKind;
import com.learnai.entity.enums.JobStatus;
import com.learnai.entity.enums.JobType;
import com.learnai.repository.ImageRepository;
import com.learnai.repository.ImageSessionRepository;
import com.learnai.repository.JobRepository;
import com.learnai.service.image.ImageService;
import com.learnai.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import reactor.core.publisher.Flux;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.Files;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** IMAGE, VARIATION and BG_REMOVAL jobs (BACKEND.md §9.7). */
@Slf4j
@Component
@RequiredArgsConstructor
public class ImageJobHandler {

    private final AiServiceClient ai;
    private final JobRepository jobs;
    private final ImageRepository images;
    private final ImageSessionRepository sessions;
    private final ImageService imageService;
    private final FileStorage storage;
    private final JobService jobService;
    private final JobEventBus bus;
    private final TransactionTemplate tx;
    private final ObjectMapper json;

    public void run(UUID jobId) {
        Job job = jobs.findById(jobId).orElseThrow();
        try {
            if (job.getType() == JobType.BG_REMOVAL) removeBackground(job);
            else generate(job);
        } catch (AiServiceException e) {
            finish(job, JobStatus.FAILED, e.getCode(), e.getMessage(), null);
        } catch (RuntimeException e) {
            log.error("image job {} failed", jobId, e);
            finish(job, JobStatus.FAILED, "INTERNAL_ERROR", "The image job failed.", null);
        } finally {
            jobService.cancelRequested.remove(jobId);
        }
    }

    private void generate(Job job) {
        JsonNode p = job.getPayload();
        int count = p.path("count").asInt(1);
        List<UUID> ids = new ArrayList<>();
        ObjectNode req = json.createObjectNode().put("jobId", job.getId().toString()).put("prompt", p.path("prompt").asString())
                .put("width", p.path("width").asInt()).put("height", p.path("height").asInt()).put("count", count)
                .put("steps", p.path("steps").asInt(4));
        if (p.path("seed").isNumber()) req.put("seed", p.path("seed").asLong());
        ArrayNode outs = req.putArray("outputPaths");
        for (int i = 0; i < count; i++) {
            UUID id = UUID.randomUUID();
            ids.add(id);
            outs.add(imageService.pathFor(job.getUserId(), id));
        }
        boolean variation = job.getType() == JobType.VARIATION;
        var cancelled = Flux.interval(Duration.ofMillis(500))
                .filter(t -> jobService.cancelRequested.contains(job.getId())).next();
        for (AiEvent ev : ai.images(variation, req).takeUntilOther(cancelled).toIterable()) {
            JsonNode d = ev.data();
            switch (ev.name()) {
                case "progress" -> {
                    String stage = d.path("stage").asString("GENERATING");
                    int cur = d.path("current").asInt(0);
                    float prog = "GENERATING".equals(stage) ? 0.1f + 0.85f * Math.max(0, cur - 1) / count : 0.05f;
                    bus.publish(job.getId(), "progress", Map.of("progress", prog, "stage", stage));
                    tx.executeWithoutResult(s -> jobs.progress(job.getId(), prog, stage));
                }
                case "done" -> {
                    ArrayNode dtos = json.createArrayNode();
                    tx.executeWithoutResult(s -> {
                        int i = 0;
                        for (JsonNode img : d.path("images")) {
                            UUID id = ids.get(i++);
                            ObjectNode meta = json.createObjectNode().put("model", d.path("model").asString("FLUX.2-klein-4B"))
                                    .put("seed", img.path("seed").asLong()).put("steps", p.path("steps").asInt(4))
                                    .put("aspectRatio", p.path("aspectRatio").asString("SQUARE"))
                                    .put("durationMs", img.path("durationMs").asLong());
                            Image saved = images.saveAndFlush(Image.builder().id(id).userId(job.getUserId())
                                    .sessionId(UUID.fromString(p.path("sessionId").asString()))
                                    .parentId(p.path("parentId").isString() ? UUID.fromString(p.path("parentId").asString()) : null)
                                    .kind(variation ? ImageKind.VARIATION : ImageKind.GENERATED)
                                    .prompt(p.path("prompt").asString())
                                    .originalPrompt(p.path("originalPrompt").asString(null))
                                    .storagePath(img.path("path").asString()).sizeBytes(size(img.path("path").asString()))
                                    .width(img.path("width").asInt()).height(img.path("height").asInt()).meta(meta).build());
                            dtos.add(json.valueToTree(imageService.dto(saved)));
                        }
                        touchSession(UUID.fromString(p.path("sessionId").asString()), ids.getFirst());
                    });
                    ObjectNode result = json.createObjectNode();
                    result.set("images", dtos);
                    finish(job, JobStatus.SUCCEEDED, null, null, result);
                    return;
                }
                case "error" -> {
                    finish(job, JobStatus.FAILED, d.path("code").asString("INTERNAL_ERROR"),
                            d.path("message").asString("Image generation failed."), null);
                    return;
                }
                default -> log.debug("ignoring image event {}", ev.name());
            }
        }
        ids.forEach(id -> deleteQuietly(imageService.pathFor(job.getUserId(), id)));
        if (jobService.cancelRequested.contains(job.getId())) {
            finish(job, JobStatus.CANCELLED, "CANCELLED", "Cancelled.", null);
        } else {
            finish(job, JobStatus.FAILED, "INTERNAL_ERROR", "Image generation stopped unexpectedly.", null);
        }
    }

    private void removeBackground(Job job) {
        JsonNode p = job.getPayload();
        Image parent = images.findById(UUID.fromString(p.path("parentId").asString())).orElse(null);
        if (parent == null) {
            finish(job, JobStatus.FAILED, "NOT_FOUND", "The image was deleted.", null);
            return;
        }
        bus.publish(job.getId(), "progress", Map.of("progress", 0.2f, "stage", "REMOVING_BACKGROUND"));
        tx.executeWithoutResult(s -> jobs.progress(job.getId(), 0.2f, "REMOVING_BACKGROUND"));
        UUID id = UUID.randomUUID();
        String out = imageService.pathFor(job.getUserId(), id);
        JsonNode r = ai.removeBackground(parent.getStoragePath(), out);
        ArrayNode dtos = json.createArrayNode();
        tx.executeWithoutResult(s -> {
            ObjectNode meta = parent.getMeta() instanceof ObjectNode o ? o.deepCopy() : json.createObjectNode();
            meta.put("model", "rembg isnet-general-use");
            Image saved = images.saveAndFlush(Image.builder().id(id).userId(job.getUserId()).sessionId(parent.getSessionId())
                    .parentId(parent.getId()).kind(ImageKind.BG_REMOVED).prompt(parent.getPrompt())
                    .originalPrompt(parent.getOriginalPrompt()).storagePath(r.path("outputPath").asString(out))
                    .sizeBytes(size(out)).width(r.path("width").asInt(parent.getWidth()))
                    .height(r.path("height").asInt(parent.getHeight())).meta(meta).build());
            dtos.add(json.valueToTree(imageService.dto(saved)));
            touchSession(parent.getSessionId(), id);
        });
        ObjectNode result = json.createObjectNode();
        result.set("images", dtos);
        finish(job, JobStatus.SUCCEEDED, null, null, result);
    }

    private void touchSession(UUID sessionId, UUID cover) {
        sessions.findById(sessionId).ifPresent(s -> {
            if (s.getCoverImageId() == null) s.setCoverImageId(cover);
            s.setUpdatedAt(Instant.now());
            sessions.save(s);
        });
    }

    private long size(String rel) {
        try {
            return Files.size(storage.resolve(rel));
        } catch (IOException e) {
            return 0;
        }
    }

    private void deleteQuietly(String rel) {
        try {
            Files.deleteIfExists(storage.resolve(rel));
        } catch (IOException ignored) {
            // nothing to clean up
        }
    }

    private void finish(Job job, JobStatus status, String code, String error, JsonNode result) {
        tx.executeWithoutResult(s -> jobs.findById(job.getId()).ifPresent(j -> {
            if (j.getStatus().isTerminal()) return;
            j.setStatus(status);
            j.setError(error);
            j.setFinishedAt(Instant.now());
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
