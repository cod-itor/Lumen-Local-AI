package com.learnai.repository;

import com.learnai.entity.EvalRun;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;
import java.util.UUID;

public interface EvalRunRepository extends JpaRepository<EvalRun, UUID> {

    Optional<EvalRun> findByIdAndUserId(UUID id, UUID userId);

    Page<EvalRun> findByUserIdOrderByCreatedAtDesc(UUID userId, Pageable page);

    Page<EvalRun> findByUserIdAndProviderIdOrderByCreatedAtDesc(UUID userId, UUID providerId, Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from EvalRun r where r.id = :id")
    Optional<EvalRun> findForUpdate(UUID id);
}
