package com.learnai.repository;

import com.learnai.entity.TurnMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.UUID;

public interface TurnMetricsRepository extends JpaRepository<TurnMetrics, UUID> {

    @Modifying
    @Query("delete from TurnMetrics m where m.createdAt < :cutoff")
    int deleteOlderThan(Instant cutoff);
}
