package com.learnai.harness;

import com.learnai.entity.Message;
import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.MessageStatus;
import com.learnai.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** HARNESS.md §7.5 steps 1–3 (the AI service does steps 4–6). */
@Component
@RequiredArgsConstructor
public class HistoryBuilder {

    static final int MAX_MESSAGES = 40;

    public record History(List<Map<String, String>> messages, String previousUserMessage) {}

    private final MessageRepository messages;

    /** @param parentId the parent of the user message being answered (history ends there) */
    public History build(UUID chatId, UUID parentId) {
        if (parentId == null) return new History(List.of(), null);
        Map<UUID, Message> byId = new HashMap<>();
        for (Message m : messages.findByChatIdOrderByCreatedAtAsc(chatId, Limit.of(1001))) byId.put(m.getId(), m);
        List<Message> path = new ArrayList<>();
        for (UUID id = parentId; id != null && byId.containsKey(id) && path.size() < 1000; ) {
            Message m = byId.get(id);
            path.add(m);
            id = m.getParentId();
        }
        Collections.reverse(path);
        if (path.size() > MAX_MESSAGES) path = path.subList(path.size() - MAX_MESSAGES, path.size());

        List<Map<String, String>> out = new ArrayList<>();
        String previousUser = null;
        for (int i = 0; i < path.size(); i++) {
            Message m = path.get(i);
            if (m.getRole() == MessageRole.USER) previousUser = userText(m);
            if (m.getRole() != MessageRole.USER || i + 1 >= path.size()) continue;
            Message a = path.get(i + 1);
            if (a.getRole() != MessageRole.ASSISTANT) continue;
            MessageStatus st = a.getStatus();
            if (st == MessageStatus.BLOCKED) continue;
            if (st != MessageStatus.COMPLETE && st != MessageStatus.STOPPED && st != MessageStatus.ABSTAINED) continue;
            out.add(Map.of("role", "user", "content", userText(m)));
            out.add(Map.of("role", "assistant", "content",
                    a.getOriginalContent() != null ? a.getOriginalContent() : a.getContent()));
            i++;
        }
        return new History(out, previousUser);
    }

    private static String userText(Message m) {
        return m.getModelInput() != null ? m.getModelInput() : m.getContent();
    }
}
