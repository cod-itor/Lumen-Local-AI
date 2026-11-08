package com.learnai.controller;

import com.learnai.dto.request.ImageRequests;
import com.learnai.dto.response.ImageDtos.ImageDto;
import com.learnai.dto.response.ImageDtos.ImageSessionDto;
import com.learnai.dto.response.ImageDtos.JobStarted;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.Image;
import com.learnai.ratelimit.RateLimit;
import com.learnai.security.CurrentUser;
import com.learnai.service.image.ImageService;
import com.learnai.storage.FileStorage;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** API_CONTRACT §6.7. Clarify and prompt rewriting are harness tasks; these are the image jobs and the gallery. */
@Tag(name = "Images")
@RestController
@RequiredArgsConstructor
public class ImageController {

    private final ImageService images;
    private final FileStorage storage;

    @GetMapping("/api/image-sessions")
    public PageResponse<ImageSessionDto> sessions(@AuthenticationPrincipal CurrentUser user,
                                                 @RequestParam(defaultValue = "0") int page,
                                                 @RequestParam(defaultValue = "20") int size) {
        return images.sessions(user.id(), page, size);
    }

    @PostMapping("/api/image-sessions")
    @ResponseStatus(HttpStatus.CREATED)
    public ImageSessionDto create(@AuthenticationPrincipal CurrentUser user,
                                  @Valid @RequestBody(required = false) ImageRequests.CreateSession body) {
        return images.create(user.id(), body);
    }

    @PatchMapping("/api/image-sessions/{id}")
    public ImageSessionDto rename(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                  @Valid @RequestBody ImageRequests.RenameSession body) {
        return images.rename(user.id(), id, body);
    }

    @DeleteMapping("/api/image-sessions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        images.deleteSession(user.id(), id);
    }

    @GetMapping("/api/images")
    public PageResponse<ImageDto> list(@AuthenticationPrincipal CurrentUser user, @RequestParam UUID sessionId,
                                       @RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "40") int size) {
        return images.list(user.id(), sessionId, page, size);
    }

    @RateLimit("images.generate")
    @PostMapping("/api/images/generate")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobStarted generate(@AuthenticationPrincipal CurrentUser user,
                               @Valid @RequestBody ImageRequests.Generate body) {
        return images.generate(user.id(), body);
    }

    @RateLimit("images.generate")
    @PostMapping("/api/images/{id}/variations")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobStarted variations(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                 @Valid @RequestBody ImageRequests.Variations body) {
        return images.variations(user.id(), id, body);
    }

    @PostMapping("/api/images/{id}/remove-background")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobStarted removeBackground(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return images.removeBackground(user.id(), id);
    }

    @DeleteMapping("/api/images/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        images.delete(user.id(), id);
    }

    @GetMapping("/api/files/images/{id}")
    public ResponseEntity<Resource> file(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        Image i = images.own(user.id(), id);
        return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=31536000, immutable")
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(storage.resolve(i.getStoragePath())));
    }
}
