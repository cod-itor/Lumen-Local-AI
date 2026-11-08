package com.learnai.repository;

import com.learnai.entity.Image;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ImageRepository extends JpaRepository<Image, UUID> {

    Optional<Image> findByIdAndUserId(UUID id, UUID userId);

    Page<Image> findBySessionIdOrderByCreatedAtDesc(UUID sessionId, Pageable page);

    List<Image> findBySessionId(UUID sessionId);

    @Query("select coalesce(sum(i.sizeBytes), 0) from Image i where i.userId = :userId")
    long totalBytes(UUID userId);
}
