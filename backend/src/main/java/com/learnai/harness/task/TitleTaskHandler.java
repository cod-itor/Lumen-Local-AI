package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.Chat;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.Message;
import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TitleSource;
import com.learnai.exception.ApiException;
import com.learnai.repository.ChatRepository;
import com.learnai.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

/** TITLE (HARNESS.md §11.1, BACKEND.md §7.6 TitleTaskHandler). No lock; never retried. */
@Component
@RequiredArgsConstructor
public class TitleTaskHandler implements TaskHandler {

    private final ChatRepository chats;
    private final MessageRepository messages;
    private final ObjectMapper json;

    @Override
    public Task task() {
        return Task.TITLE;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        UUID chatId = r.chatId() != null ? r.chatId() : r.target() != null ? r.target().id() : null;
        if (chatId == null) throw ApiException.validation("chatId", "chatId is required for TITLE.");
        chats.findByIdAndUserId(chatId, userId).orElseThrow(() -> ApiException.notFound("chat"));
        return new Target("CHAT", chatId, chatId, null);
    }

    @Override
    public ObjectNode taskInput(HarnessTurn t) {
        List<Message> all = messages.findByChatIdOrderByCreatedAtAsc(t.getChatId(), Limit.of(50));
        Message user = all.stream().filter(m -> m.getRole() == MessageRole.USER).findFirst().orElse(null);
        Message answer = user == null ? null : all.stream()
                .filter(m -> m.getRole() == MessageRole.ASSISTANT && user.getId().equals(m.getParentId()))
                .findFirst().orElse(null);
        ObjectNode ti = json.createObjectNode();
        ObjectNode conv = ti.putObject("conversation");
        conv.put("user", cut(user == null ? "" : user.getContent()));
        conv.put("assistant", cut(answer == null ? "" : answer.getOriginalContent() != null
                ? answer.getOriginalContent() : answer.getContent()));
        return ti;
    }

    @Override
    public Object apply(HarnessTurn t, JsonNode r) {
        String title = r.path("data").path("title").asString(null);
        if (title != null) {
            title = title.replaceAll("[\"'“”‘’\\r\\n]", " ").replaceAll("\\s+", " ").strip();
            int words = title.isEmpty() ? 0 : title.split(" ").length;
            if (words < 2 || words > 8) title = null;
            else if (title.length() > 60) title = title.substring(0, 60).strip();
        }
        Chat chat = chats.findForUpdate(t.getChatId()).orElseThrow(() -> new Discard("chat deleted"));
        if (title == null || !(chat.getTitleSource() == TitleSource.DEFAULT
                || chat.getTitleSource() == TitleSource.AUTO)) {
            return Collections.singletonMap("title", null);
        }
        chat.setTitle(title);
        chat.setTitleSource(TitleSource.AI);
        chats.save(chat);
        return Collections.singletonMap("title", title);
    }

    private static String cut(String s) {
        return s.length() <= 600 ? s : s.substring(0, 600);
    }
}
