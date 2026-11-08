package com.learnai.service.impl;

import com.learnai.dto.request.CreateChatRequest;
import com.learnai.dto.request.UpdateChatRequest;
import com.learnai.dto.response.ChatDto;
import com.learnai.dto.response.ChatMessagesResponse;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.Chat;
import com.learnai.entity.enums.Tab;
import com.learnai.entity.enums.TitleSource;
import com.learnai.exception.ApiException;
import com.learnai.mapper.MessageMapper;
import com.learnai.repository.ChatRepository;
import com.learnai.repository.MessageRepository;
import com.learnai.service.ChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ChatServiceImpl implements ChatService {

    static final int MAX_MESSAGES = 1000;

    private final ChatRepository chats;
    private final MessageRepository messages;
    private final MessageMapper mapper;

    @Override
    @Transactional(readOnly = true)
    public PageResponse<ChatDto> list(UUID userId, Tab tab, String q, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(0, page), Math.clamp(size, 1, 100));
        var p = q == null || q.isBlank()
                ? chats.findByUserIdAndTabOrderByUpdatedAtDesc(userId, tab, pr)
                : chats.findByUserIdAndTabAndTitleContainingIgnoreCaseOrderByUpdatedAtDesc(userId, tab, q.trim(), pr);
        return PageResponse.of(p, mapper::toDto);
    }

    @Override
    @Transactional
    public ChatDto create(UUID userId, CreateChatRequest r) {
        if (r.documentIds() != null && !r.documentIds().isEmpty()) {
            throw ApiException.validation("documentIds", "Documents are not available yet.");
        }
        Chat c = Chat.builder().userId(userId).tab(r.tab()).updatedAt(Instant.now()).build();
        if (r.title() != null && !r.title().isBlank()) {
            c.setTitle(r.title().trim());
            c.setTitleSource(TitleSource.USER);
        }
        return mapper.toDto(chats.saveAndFlush(c));
    }

    @Override
    @Transactional(readOnly = true)
    public ChatDto get(UUID userId, UUID chatId) {
        return mapper.toDto(owned(userId, chatId));
    }

    @Override
    @Transactional
    public ChatDto update(UUID userId, UUID chatId, UpdateChatRequest r) {
        Chat c = owned(userId, chatId);
        if (r.title() != null) {
            if (r.title().isBlank()) throw ApiException.validation("title", "Title must not be empty.");
            c.setTitle(r.title().trim());
            c.setTitleSource(TitleSource.USER);
            c.setUpdatedAt(Instant.now());
        }
        if (r.documentIds() != null && !r.documentIds().isEmpty()) {
            throw ApiException.validation("documentIds", "Documents are not available yet.");
        }
        if (r.activeLeafId() != null) {
            messages.findByIdAndChatId(r.activeLeafId(), chatId)
                    .orElseThrow(() -> ApiException.validation("activeLeafId", "Message is not part of this chat."));
            c.setActiveLeafId(r.activeLeafId());
        }
        return mapper.toDto(chats.saveAndFlush(c));
    }

    @Override
    @Transactional
    public void delete(UUID userId, UUID chatId) {
        chats.delete(owned(userId, chatId));
    }

    @Override
    @Transactional(readOnly = true)
    public ChatMessagesResponse messages(UUID userId, UUID chatId) {
        Chat c = owned(userId, chatId);
        var list = messages.findByChatIdOrderByCreatedAtAsc(chatId, Limit.of(MAX_MESSAGES + 1));
        if (list.size() > MAX_MESSAGES) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "This chat is too long to load.");
        }
        return new ChatMessagesResponse(chatId, c.getActiveLeafId(), list.stream().map(mapper::toDto).toList());
    }

    private Chat owned(UUID userId, UUID chatId) {
        return chats.findByIdAndUserId(chatId, userId).orElseThrow(() -> ApiException.notFound("chat"));
    }
}
