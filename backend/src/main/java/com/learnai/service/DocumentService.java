package com.learnai.service;

import com.learnai.dto.response.ChunkDto;
import com.learnai.dto.response.DocumentDto;
import com.learnai.dto.response.DocumentTextDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.dto.response.UploadResponse;
import com.learnai.entity.Document;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

public interface DocumentService {
    UploadResponse upload(UUID userId, MultipartFile file);

    PageResponse<DocumentDto> list(UUID userId, int page, int size);

    DocumentDto get(UUID userId, UUID id);

    Document own(UUID userId, UUID id);

    DocumentTextDto text(UUID userId, UUID id, Integer page);

    ChunkDto chunk(UUID userId, UUID id, UUID chunkId);

    void delete(UUID userId, UUID id);

    DocumentDto toDto(Document d);
}
