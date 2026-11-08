package com.learnai.service;

import com.learnai.dto.request.CreateChatRequest;
import com.learnai.dto.request.UpdateChatRequest;
import com.learnai.dto.response.ChatDto;
import com.learnai.dto.response.ChatMessagesResponse;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.enums.Tab;

import java.util.UUID;

public interface ChatService {
    PageResponse<ChatDto> list(UUID userId, Tab tab, String q, int page, int size);

    ChatDto create(UUID userId, CreateChatRequest r);

    ChatDto get(UUID userId, UUID chatId);

    ChatDto update(UUID userId, UUID chatId, UpdateChatRequest r);

    void delete(UUID userId, UUID chatId);

    ChatMessagesResponse messages(UUID userId, UUID chatId);
}
