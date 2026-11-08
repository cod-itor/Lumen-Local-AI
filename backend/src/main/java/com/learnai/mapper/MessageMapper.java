package com.learnai.mapper;

import com.learnai.dto.response.ChatDto;
import com.learnai.dto.response.MessageDto;
import com.learnai.entity.Chat;
import com.learnai.entity.Message;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.List;

/** Entity → DTO for chats and messages (JSON columns pass through as trees). */
@Component
public class MessageMapper {

    private final ObjectMapper json;

    public MessageMapper(ObjectMapper json) {
        this.json = json;
    }

    public MessageDto toDto(Message m) {
        ObjectNode meta = m.getMeta() instanceof ObjectNode o ? o.deepCopy() : json.createObjectNode();
        if (!meta.has("feedback")) meta.putNull("feedback");
        JsonNode translations = m.getTranslations() == null ? json.createObjectNode() : m.getTranslations();
        return new MessageDto(m.getId(), m.getChatId(), m.getParentId(), m.getRole(), m.getContent(),
                m.getOriginalContent(), translations, m.getStatus(), meta, m.getCreatedAt());
    }

    public ChatDto toDto(Chat c) {
        return new ChatDto(c.getId(), c.getTab(), c.getTitle(), c.getTitleSource(), List.of(), c.getActiveLeafId(),
                c.getLastMessagePreview(), c.getCreatedAt(), c.getUpdatedAt());
    }
}
