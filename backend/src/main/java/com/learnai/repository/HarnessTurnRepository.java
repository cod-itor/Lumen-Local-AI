package com.learnai.repository;

import com.learnai.entity.HarnessTurn;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HarnessTurnRepository extends JpaRepository<HarnessTurn, UUID> {

    Optional<HarnessTurn> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from HarnessTurn t where t.id = :id")
    Optional<HarnessTurn> findForUpdate(UUID id);

    /** Conditional status change (BACKEND.md §7.1): 0 rows = another path won the race. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE harness_turns SET status = :to, updated_at = now(),
                   completed_at = CASE WHEN :terminal THEN now() ELSE completed_at END
             WHERE id = :id AND status IN (:from)""", nativeQuery = true)
    int transition(UUID id, Collection<String> from, String to, boolean terminal);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            UPDATE harness_turns SET status = 'FAILED', error_code = :code, updated_at = now(), completed_at = now()
             WHERE id = :id AND status IN (:from)""", nativeQuery = true)
    int fail(UUID id, Collection<String> from, String code);

    @Query(value = """
            UPDATE harness_turns SET status = 'EXPIRED', completed_at = now(), updated_at = now()
             WHERE status IN ('PREPARING', 'AWAITING_APPROVAL', 'READY') AND expires_at < :now
            RETURNING id""", nativeQuery = true)
    List<UUID> expireOpenTurns(Instant now);

    @Query(value = """
            UPDATE harness_turns SET status = 'FAILED', error_code = 'AI_TIMEOUT', completed_at = now(), updated_at = now()
             WHERE status IN ('GENERATING', 'FINALIZING') AND updated_at < :cutoff
            RETURNING id""", nativeQuery = true)
    List<UUID> failStuckTurns(Instant cutoff);

    @Modifying
    @Query(value = "UPDATE harness_turns SET prepared_messages = NULL WHERE prepared_messages IS NOT NULL "
            + "AND created_at < :cutoff", nativeQuery = true)
    int purgePreparedMessages(Instant cutoff);

    @Query(value = """
            SELECT id FROM harness_turns WHERE lock_key = :lockKey
               AND status IN ('PREPARING', 'AWAITING_APPROVAL', 'READY', 'GENERATING', 'FINALIZING')""",
            nativeQuery = true)
    List<UUID> findOpenByLockKey(String lockKey);
}
