package com.learnai.repository;

import com.learnai.entity.Job;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface JobRepository extends JpaRepository<Job, UUID> {

    Optional<Job> findByIdAndUserId(UUID id, UUID userId);

    /** Claim queued jobs of the given types (BACKEND.md §9.1). */
    @Query(value = """
            UPDATE jobs SET status = 'RUNNING', started_at = now(), updated_at = now()
             WHERE id IN (SELECT id FROM jobs WHERE status = 'QUEUED' AND type IN (:types)
                           ORDER BY created_at LIMIT :limit FOR UPDATE SKIP LOCKED)
            RETURNING id""", nativeQuery = true)
    List<UUID> claim(List<String> types, int limit);

    @Query(value = """
            UPDATE jobs SET status = 'FAILED', error = 'Interrupted by restart', finished_at = now(), updated_at = now()
             WHERE status = 'RUNNING'
            RETURNING id""", nativeQuery = true)
    List<UUID> failInterrupted();

    @Modifying
    @Query(value = """
            UPDATE jobs SET status = :status, error = :error, finished_at = now(), updated_at = now()
             WHERE id = :id AND status IN ('QUEUED', 'RUNNING')""", nativeQuery = true)
    int finishIfOpen(UUID id, String status, String error);

    @Modifying
    @Query(value = "UPDATE jobs SET progress = :progress, stage = :stage, updated_at = now() WHERE id = :id AND status = 'RUNNING'",
            nativeQuery = true)
    int progress(UUID id, float progress, String stage);
}
