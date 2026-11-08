package com.learnai.scheduling;

import com.learnai.harness.TurnOutcomeService;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.RefreshTokenRepository;
import com.learnai.repository.TurnMetricsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** BACKEND.md §9.4. */
@Slf4j
@Component
@RequiredArgsConstructor
public class HousekeepingTasks {

    private final HarnessTurnRepository turns;
    private final TurnMetricsRepository metrics;
    private final RefreshTokenRepository refreshTokens;
    private final TurnOutcomeService outcomes;
    private final TransactionTemplate tx;

    @Scheduled(fixedDelay = 60_000, initialDelay = 30_000)
    public void expireTurns() {
        Instant now = Instant.now();
        List<UUID> expired = tx.execute(s -> turns.expireOpenTurns(now));
        List<UUID> stuck = tx.execute(s -> turns.failStuckTurns(now.minus(Duration.ofMinutes(15))));
        for (UUID id : expired == null ? List.<UUID>of() : expired) outcomes.onTerminal(id);
        for (UUID id : stuck == null ? List.<UUID>of() : stuck) outcomes.onTerminal(id);
        if ((expired != null && !expired.isEmpty()) || (stuck != null && !stuck.isEmpty())) {
            log.info("Housekeeping: {} turns expired, {} stuck turns failed",
                    expired == null ? 0 : expired.size(), stuck == null ? 0 : stuck.size());
        }
    }

    @Scheduled(cron = "0 30 3 * * *")
    public void purge() {
        Instant now = Instant.now();
        tx.executeWithoutResult(s -> {
            turns.purgePreparedMessages(now.minus(Duration.ofDays(7)));
            metrics.deleteOlderThan(now.minus(Duration.ofDays(180)));
            refreshTokens.deleteExpired(now.minus(Duration.ofDays(30)));
        });
    }
}
