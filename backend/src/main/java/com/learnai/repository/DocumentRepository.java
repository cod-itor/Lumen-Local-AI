package com.learnai.repository;

import com.learnai.entity.Document;
import com.learnai.entity.enums.DocumentStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DocumentRepository extends JpaRepository<Document, UUID> {

    Page<Document> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    Optional<Document> findByIdAndUserId(UUID id, UUID userId);

    Optional<Document> findFirstByUserIdAndSha256AndStatus(UUID userId, String sha256, DocumentStatus status);

    List<Document> findByUserIdAndIdIn(UUID userId, Collection<UUID> ids);

    @Query("select coalesce(sum(d.sizeBytes), 0) from Document d where d.userId = :userId")
    long totalBytes(UUID userId);

    @Modifying
    @Query(value = """
            UPDATE documents SET status = 'FAILED', error = :error, updated_at = now()
             WHERE id = :id AND status IN ('UPLOADED', 'PARSING', 'EMBEDDING')""", nativeQuery = true)
    int failIfOpen(UUID id, String error);
}
