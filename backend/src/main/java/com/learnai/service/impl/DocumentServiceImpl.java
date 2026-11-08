package com.learnai.service.impl;

import com.learnai.client.AiServiceClient;
import com.learnai.client.AiServiceException;
import com.learnai.config.AppProperties;
import com.learnai.dto.response.ChunkDto;
import com.learnai.dto.response.DocumentDto;
import com.learnai.dto.response.DocumentTextDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.dto.response.UploadResponse;
import com.learnai.entity.Document;
import com.learnai.entity.Job;
import com.learnai.entity.enums.DocumentStatus;
import com.learnai.entity.enums.JobType;
import com.learnai.exception.ApiException;
import com.learnai.repository.DocumentRepository;
import com.learnai.repository.JobRepository;
import com.learnai.service.DocumentService;
import com.learnai.storage.FileStorage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Upload, library, page text and chunks, delete (BACKEND.md §9.2). */
@Slf4j
@Service
@RequiredArgsConstructor
public class DocumentServiceImpl implements DocumentService {

    private static final Map<String, String> MIME = Map.of(
            "pdf", "application/pdf",
            "docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "txt", "text/plain",
            "md", "text/markdown");

    private final DocumentRepository documents;
    private final JobRepository jobs;
    private final FileStorage storage;
    private final AppProperties props;
    private final AiServiceClient ai;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final ObjectMapper json;

    @Override
    public UploadResponse upload(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) throw ApiException.validation("file", "file is required");
        if (file.getSize() > props.maxUploadMb() * 1024L * 1024L) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "PAYLOAD_TOO_LARGE",
                    "Files can be at most " + props.maxUploadMb() + " MB.");
        }
        String original = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        int dot = original.lastIndexOf('.');
        String ext = dot < 0 ? "" : original.substring(dot + 1).toLowerCase(Locale.ROOT);
        String mime = MIME.get(ext);
        if (mime == null) throw unsupported();
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw ApiException.validation("file", "The file could not be read.");
        }
        if (!sniff(ext, bytes)) throw unsupported();

        long quota = props.userStorageQuotaMb() * 1024L * 1024L;
        if (documents.totalBytes(userId) + bytes.length > quota) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "QUOTA_EXCEEDED",
                    "Your storage is full. Delete some documents first.");
        }
        String hash = sha256(bytes);
        var dup = documents.findFirstByUserIdAndSha256AndStatus(userId, hash, DocumentStatus.READY);
        if (dup.isPresent()) return new UploadResponse(toDto(dup.get()), null, true);

        UUID id = UUID.randomUUID();
        String path = storage.documentPath(userId, id, ext);
        storage.write(path, bytes);
        try {
            return tx.execute(s -> {
                Document d = documents.saveAndFlush(Document.builder().id(id).userId(userId)
                        .filename(FileStorage.sanitizeFilename(original, ext)).mime(mime).sizeBytes(bytes.length)
                        .sha256(hash).storagePath(path).build());
                Job j = jobs.saveAndFlush(Job.builder().userId(userId).type(JobType.INGEST)
                        .payload(json.createObjectNode().put("documentId", id.toString())).build());
                return new UploadResponse(toDto(d), j.getId(), false);
            });
        } catch (RuntimeException e) {
            storage.deleteDocumentFolder(userId, id);
            throw e;
        }
    }

    private static ApiException unsupported() {
        return new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE",
                "Upload a PDF, Word (.docx), text (.txt) or Markdown (.md) file.");
    }

    /** Content sniffing (BACKEND.md §9.2 step 2). */
    static boolean sniff(String ext, byte[] b) {
        return switch (ext) {
            case "pdf" -> b.length > 5 && new String(b, 0, 5, StandardCharsets.US_ASCII).equals("%PDF-");
            case "docx" -> b.length > 4 && b[0] == 'P' && b[1] == 'K' && b[2] == 3 && b[3] == 4 && zipHasWordXml(b);
            case "txt", "md" -> strictUtf8(b);
            default -> false;
        };
    }

    private static boolean zipHasWordXml(byte[] b) {
        try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(b))) {
            for (ZipEntry e; (e = z.getNextEntry()) != null; ) {
                if ("word/document.xml".equals(e.getName())) return true;
            }
        } catch (IOException ignored) {
            // not a valid zip
        }
        return false;
    }

    private static boolean strictUtf8(byte[] b) {
        for (byte x : b) if (x == 0) return false;
        try {
            StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(b));
            return true;
        } catch (CharacterCodingException e) {
            return false;
        }
    }

    private static String sha256(byte[] b) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public PageResponse<DocumentDto> list(UUID userId, int page, int size) {
        var p = documents.findByUserIdOrderByCreatedAtDesc(userId,
                PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100)));
        return PageResponse.of(p, this::toDto);
    }

    @Override
    public DocumentDto get(UUID userId, UUID id) {
        return toDto(own(userId, id));
    }

    @Override
    public Document own(UUID userId, UUID id) {
        return documents.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("document"));
    }

    @Override
    public DocumentTextDto text(UUID userId, UUID id, Integer page) {
        Document d = own(userId, id);
        if (d.getStatus() != DocumentStatus.READY) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This document is not ready yet.");
        }
        Integer total = d.getPages();
        int n = page == null ? 1 : page;
        if (total != null && (n < 1 || n > total)) throw ApiException.validation("page", "page is out of range");
        if (total == null && page != null && page != 1) throw ApiException.validation("page", "page is out of range");
        Path f = storage.pageFile(userId, id, n);
        try {
            return new DocumentTextDto(id, total == null ? null : n, Files.readString(f), total);
        } catch (IOException e) {
            throw ApiException.notFound("page text");
        }
    }

    @Override
    public ChunkDto chunk(UUID userId, UUID id, UUID chunkId) {
        own(userId, id);
        ChunkDto c = jdbc.query("""
                        SELECT id, document_id, page, start_char, end_char, text FROM chunks
                         WHERE id = ? AND document_id = ? AND user_id = ? AND source = 'DOC'""",
                rs -> rs.next() ? new ChunkDto(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class),
                        (Integer) rs.getObject(3), rs.getInt(4), rs.getInt(5), rs.getString(6)) : null,
                chunkId, id, userId);
        if (c == null) throw ApiException.notFound("chunk");
        return c;
    }

    @Override
    public void delete(UUID userId, UUID id) {
        Document d = own(userId, id);
        try {
            ai.deleteDocumentChunks(id);
        } catch (AiServiceException e) {
            log.debug("chunks of {} are removed by the cascade instead", id);
        }
        tx.executeWithoutResult(s -> documents.deleteById(d.getId()));
        storage.deleteDocumentFolder(userId, id);
    }

    @Override
    public DocumentDto toDto(Document d) {
        return new DocumentDto(d.getId(), d.getFilename(), d.getMime(), d.getSizeBytes(), d.getPages(), d.getStatus(),
                d.getError(), d.getChunkCount(), d.getLanguage(), d.getCreatedAt());
    }
}
