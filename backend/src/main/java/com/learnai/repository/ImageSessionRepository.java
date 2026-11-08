package com.learnai.repository;

import com.learnai.entity.ImageSession;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ImageSessionRepository extends JpaRepository<ImageSession, UUID> {

    Optional<ImageSession> findByIdAndUserId(UUID id, UUID userId);

    Page<ImageSession> findByUserIdOrderByUpdatedAtDesc(UUID userId, Pageable page);
}
