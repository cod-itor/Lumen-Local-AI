package com.learnai.controller;

import com.learnai.dto.response.ChunkDto;
import com.learnai.dto.response.DocumentDto;
import com.learnai.dto.response.DocumentTextDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.dto.response.UploadResponse;
import com.learnai.entity.Document;
import com.learnai.security.CurrentUser;
import com.learnai.service.DocumentService;
import com.learnai.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documents;
    private final FileStorage storage;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse upload(@AuthenticationPrincipal CurrentUser user, @RequestParam("file") MultipartFile file) {
        return documents.upload(user.id(), file);
    }

    @GetMapping
    public PageResponse<DocumentDto> list(@AuthenticationPrincipal CurrentUser user,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "50") int size) {
        return documents.list(user.id(), page, size);
    }

    @GetMapping("/{id}")
    public DocumentDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return documents.get(user.id(), id);
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> file(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        Document d = documents.own(user.id(), id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(d.getMime()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(d.getFilename(), StandardCharsets.UTF_8).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=86400")
                .header("X-Content-Type-Options", "nosniff")
                .body(new FileSystemResource(storage.resolve(d.getStoragePath())));
    }

    @GetMapping("/{id}/text")
    public DocumentTextDto text(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                @RequestParam(required = false) Integer page) {
        return documents.text(user.id(), id, page);
    }

    @GetMapping("/{id}/chunks/{chunkId}")
    public ChunkDto chunk(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id, @PathVariable UUID chunkId) {
        return documents.chunk(user.id(), id, chunkId);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        documents.delete(user.id(), id);
    }
}
