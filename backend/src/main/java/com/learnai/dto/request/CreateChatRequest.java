package com.learnai.dto.request;

import com.learnai.entity.enums.Tab;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateChatRequest(@NotNull Tab tab, @Size(max = 80) String title, List<UUID> documentIds) {}
