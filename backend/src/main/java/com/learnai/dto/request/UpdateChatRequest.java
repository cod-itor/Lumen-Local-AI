package com.learnai.dto.request;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record UpdateChatRequest(@Size(min = 1, max = 80) String title, List<UUID> documentIds, UUID activeLeafId) {}
