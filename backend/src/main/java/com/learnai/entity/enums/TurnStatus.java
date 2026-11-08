package com.learnai.entity.enums;

import java.util.EnumSet;
import java.util.Set;

/** HARNESS.md §3.1. */
public enum TurnStatus {
    PREPARING, AWAITING_APPROVAL, READY, GENERATING, FINALIZING,
    COMPLETED, BLOCKED, ABSTAINED, CANCELLED, EXPIRED, FAILED;

    public static final Set<TurnStatus> OPEN = EnumSet.of(PREPARING, AWAITING_APPROVAL, READY, GENERATING, FINALIZING);

    public boolean isTerminal() {
        return !OPEN.contains(this);
    }
}
