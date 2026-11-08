package com.learnai.dto.response;

import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;

import java.util.UUID;

/** API_CONTRACT §4.6 TurnResult — the `done` event and the `complete` response. */
public record TurnResult(UUID turnId, Task task, TurnStatus status, MessageDto message, Object data, String notice,
                         String guardAction) {}
