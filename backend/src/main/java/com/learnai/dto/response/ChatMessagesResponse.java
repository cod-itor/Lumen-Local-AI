package com.learnai.dto.response;

import java.util.List;
import java.util.UUID;

public record ChatMessagesResponse(UUID chatId, UUID activeLeafId, List<MessageDto> messages) {}
