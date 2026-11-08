package com.learnai.controller;

import com.learnai.dto.request.CreateChatRequest;
import com.learnai.dto.request.UpdateChatRequest;
import com.learnai.dto.response.ChatDto;
import com.learnai.dto.response.ChatMessagesResponse;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.enums.Tab;
import com.learnai.security.CurrentUser;
import com.learnai.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/chats")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chats;

    @GetMapping
    public PageResponse<ChatDto> list(@AuthenticationPrincipal CurrentUser user,
                                      @RequestParam(defaultValue = "CHAT") Tab tab,
                                      @RequestParam(required = false) String q,
                                      @RequestParam(required = false) UUID projectId,
                                      @RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size) {
        return chats.list(user.id(), tab, q, projectId, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ChatDto create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody CreateChatRequest request) {
        return chats.create(user.id(), request);
    }

    @GetMapping("/{id}")
    public ChatDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return chats.get(user.id(), id);
    }

    @PatchMapping("/{id}")
    public ChatDto update(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                          @Valid @RequestBody UpdateChatRequest request) {
        return chats.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        chats.delete(user.id(), id);
    }

    @GetMapping("/{id}/messages")
    public ChatMessagesResponse messages(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return chats.messages(user.id(), id);
    }
}
