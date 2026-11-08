package com.learnai.dto.request;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** Partial update; `removeFromProject: true` clears `projectId` (null means "unchanged"). */
public record UpdateChatRequest(@Size(min = 1, max = 80) String title, List<UUID> documentIds, UUID activeLeafId,
                                Boolean pinned, UUID projectId, Boolean removeFromProject) {}
