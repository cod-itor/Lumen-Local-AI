package com.learnai.dto.response;

import com.learnai.entity.enums.Tab;
import com.learnai.entity.enums.TitleSource;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ChatDto(UUID id, Tab tab, String title, TitleSource titleSource, List<UUID> documentIds,
                      UUID activeLeafId, String lastMessagePreview, Instant createdAt, Instant updatedAt) {}
