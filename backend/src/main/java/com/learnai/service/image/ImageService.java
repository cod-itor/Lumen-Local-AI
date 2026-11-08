package com.learnai.service.image;

import com.learnai.client.AiServiceClient;
import com.learnai.config.AppProperties;
import com.learnai.dto.request.ImageRequests;
import com.learnai.dto.response.ImageDtos.ImageDto;
import com.learnai.dto.response.ImageDtos.ImageSessionDto;
import com.learnai.dto.response.ImageDtos.JobStarted;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.Image;
import com.learnai.entity.ImageSession;
import com.learnai.entity.Job;
import com.learnai.entity.enums.JobType;
import com.learnai.exception.ApiException;
import com.learnai.harness.TurnContext;
import com.learnai.repository.DocumentRepository;
import com.learnai.repository.ImageRepository;
import com.learnai.repository.ImageSessionRepository;
import com.learnai.repository.JobRepository;
import com.learnai.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.io.IOException;
import java.nio.file.Files;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Image sessions, gallery and image jobs (BACKEND.md §9.7, API_CONTRACT §6.7). */
@Service
@RequiredArgsConstructor
public class ImageService {

    public static final Map<String, int[]> SIZES = Map.of(
            "SQUARE", new int[] {1024, 1024}, "PORTRAIT", new int[] {832, 1216},
            "LANDSCAPE", new int[] {1216, 832}, "WIDE", new int[] {1344, 768});

    private final ImageSessionRepository sessions;
    private final ImageRepository images;
    private final DocumentRepository documents;
    private final JobRepository jobs;
    private final FileStorage storage;
    private final AiServiceClient ai;
    private final TurnContext ctx;
    private final AppProperties props;
    private final ObjectMapper json;

    // ------------------------------------------------------------------ sessions

    @Transactional(readOnly = true)
    public PageResponse<ImageSessionDto> sessions(UUID userId, int page, int size) {
        return PageResponse.of(sessions.findByUserIdOrderByUpdatedAtDesc(userId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 50))), this::dto);
    }

    @Transactional
    public ImageSessionDto create(UUID userId, ImageRequests.CreateSession r) {
        String title = r == null || r.title() == null || r.title().isBlank() ? "New images" : r.title().strip();
        return dto(sessions.saveAndFlush(ImageSession.builder().userId(userId).title(title).build()));
    }

    @Transactional
    public ImageSessionDto rename(UUID userId, UUID id, ImageRequests.RenameSession r) {
        ImageSession s = session(userId, id);
        s.setTitle(r.title().strip());
        return dto(sessions.saveAndFlush(s));
    }

    @Transactional
    public void deleteSession(UUID userId, UUID id) {
        ImageSession s = session(userId, id);
        List<Image> list = images.findBySessionId(s.getId());
        sessions.delete(s);
        list.forEach(this::deleteFile);
    }

    // ------------------------------------------------------------------ gallery

    @Transactional(readOnly = true)
    public PageResponse<ImageDto> list(UUID userId, UUID sessionId, int page, int size) {
        session(userId, sessionId);
        return PageResponse.of(images.findBySessionIdOrderByCreatedAtDesc(sessionId,
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100))), this::dto);
    }

    public Image own(UUID userId, UUID id) {
        return images.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("image"));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        Image i = own(userId, id);
        images.delete(i);
        deleteFile(i);
    }

    // ------------------------------------------------------------------ jobs

    @Transactional
    public JobStarted generate(UUID userId, ImageRequests.Generate r) {
        requireFeature("images", "Image generation needs the host machine (FLUX is not installed).");
        ImageSession s = session(userId, r.sessionId());
        int steps = r.steps() == null ? 4 : r.steps();
        if (steps < 1 || steps > 8) throw ApiException.validation("steps", "steps must be 1–8.");
        checkQuota(userId);
        guard(userId, r.prompt());
        int[] wh = SIZES.get(r.aspectRatio());
        ObjectNode payload = json.createObjectNode().put("sessionId", s.getId().toString()).put("prompt", r.prompt().strip())
                .put("width", wh[0]).put("height", wh[1]).put("count", r.count()).put("steps", steps)
                .put("aspectRatio", r.aspectRatio());
        if (r.originalPrompt() != null) payload.put("originalPrompt", r.originalPrompt().strip());
        if (r.seed() != null) payload.put("seed", r.seed());
        return start(userId, JobType.IMAGE, payload);
    }

    @Transactional
    public JobStarted variations(UUID userId, UUID imageId, ImageRequests.Variations r) {
        requireFeature("images", "Image generation needs the host machine (FLUX is not installed).");
        Image parent = own(userId, imageId);
        checkQuota(userId);
        JsonNode meta = parent.getMeta();
        ObjectNode payload = json.createObjectNode().put("sessionId", parent.getSessionId().toString())
                .put("parentId", parent.getId().toString()).put("prompt", parent.getPrompt())
                .put("width", parent.getWidth()).put("height", parent.getHeight()).put("count", r.count())
                .put("steps", meta.path("steps").asInt(4)).put("aspectRatio", meta.path("aspectRatio").asString("SQUARE"))
                .put("referencePath", parent.getStoragePath());
        if (parent.getOriginalPrompt() != null) payload.put("originalPrompt", parent.getOriginalPrompt());
        return start(userId, JobType.VARIATION, payload);
    }

    @Transactional
    public JobStarted removeBackground(UUID userId, UUID imageId) {
        requireFeature("bgRemoval", "Background removal is not installed on this server.");
        Image parent = own(userId, imageId);
        checkQuota(userId);
        ObjectNode payload = json.createObjectNode().put("sessionId", parent.getSessionId().toString())
                .put("parentId", parent.getId().toString());
        return start(userId, JobType.BG_REMOVAL, payload);
    }

    // ------------------------------------------------------------------ helpers

    public String pathFor(UUID userId, UUID imageId) {
        return "users/" + userId + "/images/" + imageId + ".png";
    }

    public ImageDto dto(Image i) {
        return new ImageDto(i.getId(), i.getSessionId(), i.getParentId(), i.getKind(), i.getPrompt(), i.getOriginalPrompt(),
                "/api/files/images/" + i.getId(), i.getWidth(), i.getHeight(), i.getMeta(), i.getCreatedAt());
    }

    private ImageSessionDto dto(ImageSession s) {
        return new ImageSessionDto(s.getId(), s.getTitle(), s.getCoverImageId(), s.getCreatedAt(), s.getUpdatedAt());
    }

    private ImageSession session(UUID userId, UUID id) {
        return sessions.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("image session"));
    }

    private JobStarted start(UUID userId, JobType type, ObjectNode payload) {
        Job j = jobs.saveAndFlush(Job.builder().userId(userId).type(type).payload(payload).build());
        return new JobStarted(j.getId());
    }

    private void requireFeature(String feature, String message) {
        JsonNode caps = ai.capabilities();
        if (!caps.path("features").path(feature).asBoolean(false)) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FEATURE_UNAVAILABLE", message);
        }
    }

    /** Documents and images share the per-user storage quota (BACKEND.md §5.6). */
    private void checkQuota(UUID userId) {
        long quota = props.userStorageQuotaMb() * 1024L * 1024L;
        if (documents.totalBytes(userId) + images.totalBytes(userId) >= quota) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "QUOTA_EXCEEDED",
                    "Your storage is full. Delete some images or documents first.");
        }
    }

    private void guard(UUID userId, String prompt) {
        JsonNode g = ai.guardCheck(prompt, "IMAGE_PROMPT", ctx.settings(userId).getGuardProfile().name());
        String action = g.path("action").asString("ALLOW");
        if ("BLOCK".equals(action) || "SUPPORT".equals(action)) {
            JsonNode refusal = g.path("refusal");
            String text = refusal.isObject() ? refusal.path("EN").asString("") : refusal.asString("");
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("action", action);
            details.put("category", g.path("categories").path(0).asString(null));
            details.put("refusal", text);
            throw new ApiException(HttpStatus.BAD_REQUEST, "GUARD_BLOCKED", text, details);
        }
    }

    private void deleteFile(Image i) {
        try {
            Files.deleteIfExists(storage.resolve(i.getStoragePath()));
        } catch (IOException | RuntimeException ignored) {
            // a missing file is fine; the row is gone either way
        }
    }
}
