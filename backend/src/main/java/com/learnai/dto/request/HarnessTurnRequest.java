package com.learnai.dto.request;

import com.learnai.entity.enums.OutputLanguage;
import com.learnai.entity.enums.Task;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Map;
import java.util.UUID;

/** API_CONTRACT §4.6 HarnessTurnRequest. */
public record HarnessTurnRequest(
        @NotNull Task task,
        @NotNull UUID providerId,
        UUID chatId,
        @Size(max = 4000) String content,
        UUID parentId,
        UUID regenerateOf,
        UUID editOf,
        UUID answerOf,
        Boolean webSearch,
        OutputLanguage outputLanguage,
        @Valid Target target,
        Map<String, Object> taskInput) {

    public record Target(@NotNull String type, @NotNull UUID id) {}
}
