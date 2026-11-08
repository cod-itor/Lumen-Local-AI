package com.learnai.repository;

import com.learnai.entity.LearningPath;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface LearningPathRepository extends JpaRepository<LearningPath, UUID> {

    Optional<LearningPath> findByIdAndUserId(UUID id, UUID userId);

    Page<LearningPath> findByUserIdOrderByUpdatedAtDesc(UUID userId, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from LearningPath p where p.id = :id")
    Optional<LearningPath> findForUpdate(UUID id);
}
