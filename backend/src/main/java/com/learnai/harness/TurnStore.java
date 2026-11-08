package com.learnai.harness;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.dto.response.MessageDto;
import com.learnai.entity.Chat;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.Message;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.MessageStatus;
import com.learnai.entity.enums.ProviderKindSide;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TitleSource;
import com.learnai.entity.enums.TurnStatus;
import com.learnai.exception.ApiException;
import com.learnai.mapper.MessageMapper;
import com.learnai.repository.ChatRepository;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Every database change of a turn, each in its own transaction (BACKEND.md §7.1–7.6). */
@Component
@RequiredArgsConstructor
public class TurnStore {

    public static final int MAX_CONTENT = 4000;

    public record Created(UUID turnId, UUID userMessageId) {}

    /** What the MESSAGE task handler saves (from finalize, or from a prepare-time blocked/abstained event). */
    public record MessageResult(String content, String originalContent, JsonNode translations, MessageStatus status,
                                JsonNode guard, JsonNode grounding, JsonNode suggestions, JsonNode stats,
                                String finishReason) {}

    private final HarnessTurnRepository turns;
    private final ChatRepository chats;
    private final MessageRepository messages;
    private final MessageMapper mapper;
    private final ObjectMapper json;

    // ------------------------------------------------------------------ create (§7.2 step 5)

    @Transactional
    public Created createMessageTurn(UUID userId, HarnessTurnRequest r, ModelProvider p, Duration ttl,
                                     String outputLanguage) {
        if (r.chatId() == null) throw ApiException.validation("chatId", "chatId is required for MESSAGE.");
        int given = (r.content() != null ? 1 : 0) + (r.regenerateOf() != null ? 1 : 0) + (r.answerOf() != null ? 1 : 0);
        if (given != 1) {
            throw ApiException.validation("content", "Send exactly one of content, regenerateOf or answerOf.");
        }
        if (r.editOf() != null && r.content() == null) {
            throw ApiException.validation("editOf", "editOf requires content.");
        }
        Chat chat = chats.findByIdAndUserId(r.chatId(), userId).orElseThrow(() -> ApiException.notFound("chat"));
        Message user;
        if (r.content() != null) {
            String text = r.content().strip();
            if (text.isEmpty() || text.length() > MAX_CONTENT) {
                throw ApiException.validation("content", "Message must be 1–4000 characters.");
            }
            UUID parent;
            if (r.editOf() != null) {
                Message edited = messageOf(chat, r.editOf(), MessageRole.USER, "editOf");
                parent = edited.getParentId();
            } else if (r.parentId() != null) {
                parent = messages.findByIdAndChatId(r.parentId(), chat.getId())
                        .orElseThrow(() -> ApiException.validation("parentId", "Message is not part of this chat."))
                        .getId();
            } else {
                parent = chat.getActiveLeafId();
            }
            user = messages.save(Message.builder().chatId(chat.getId()).parentId(parent).role(MessageRole.USER)
                    .content(text).translations(json.createObjectNode())
                    .meta(userMeta(outputLanguage)).build());
            chat.setActiveLeafId(user.getId());
            chat.setLastMessagePreview(preview(text));
            chat.setUpdatedAt(Instant.now());
        } else if (r.regenerateOf() != null) {
            Message old = messageOf(chat, r.regenerateOf(), MessageRole.ASSISTANT, "regenerateOf");
            user = messages.findByIdAndChatId(old.getParentId(), chat.getId())
                    .filter(m -> m.getRole() == MessageRole.USER)
                    .orElseThrow(() -> ApiException.validation("regenerateOf", "The answer has no user message."));
        } else {
            user = messageOf(chat, r.answerOf(), MessageRole.USER, "answerOf");
            if (messages.existsByParentIdAndRole(user.getId(), MessageRole.ASSISTANT)) {
                throw ApiException.validation("answerOf", "This message already has an answer.");
            }
        }
        HarnessTurn t = HarnessTurn.builder()
                .userId(userId).chatId(chat.getId()).task(Task.MESSAGE).lockKey("chat:" + chat.getId())
                .providerId(p.getId()).providerKind(p.getKind()).model(p.getModel())
                .generation(ProviderKindSide.of(p.getKind())).status(TurnStatus.PREPARING)
                .userMessageId(user.getId()).request(json.valueToTree(r))
                .expiresAt(Instant.now().plus(ttl)).build();
        try {
            t = turns.saveAndFlush(t);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "Another request for this item is still running.");
        }
        return new Created(t.getId(), user.getId());
    }

    private Message messageOf(Chat chat, UUID id, MessageRole role, String field) {
        return messages.findByIdAndChatId(id, chat.getId()).filter(m -> m.getRole() == role)
                .orElseThrow(() -> ApiException.validation(field, "Message is not part of this chat."));
    }

    private ObjectNode userMeta(String outputLanguage) {
        ObjectNode m = json.createObjectNode().put("task", "MESSAGE");
        m.putNull("pipeline");
        m.putNull("providerKind");
        m.putNull("model");
        m.put("outputLanguage", outputLanguage);
        m.putNull("inputLanguage");
        m.putArray("sources");
        m.putNull("grounding");
        m.putNull("guard");
        m.putArray("tools");
        m.putArray("suggestions");
        m.putNull("stats");
        m.putNull("finishReason");
        return m;
    }

    static String preview(String text) {
        String flat = text.replaceAll("\\s+", " ").strip();
        return flat.length() <= 120 ? flat : flat.substring(0, 120);
    }

    // ------------------------------------------------------------------ status changes

    @Transactional
    public boolean transition(UUID id, TurnStatus to, TurnStatus... from) {
        return turns.transition(id, names(from), to.name(), to.isTerminal()) == 1;
    }

    @Transactional
    public boolean fail(UUID id, String code, TurnStatus... from) {
        String c = code == null ? "INTERNAL_ERROR" : code.length() > 40 ? code.substring(0, 40) : code;
        return turns.fail(id, names(from), c) == 1;
    }

    @Transactional
    public void savePrepared(UUID id, JsonNode context, JsonNode preparedMessages) {
        HarnessTurn t = turns.findById(id).orElseThrow();
        t.setPrepareContext(context);
        t.setPreparedMessages(preparedMessages);
        turns.save(t);
    }

    /** PREPARING → READY (CLIENT) with a fresh expiry. */
    @Transactional
    public boolean toReady(UUID id, Duration ttl) {
        HarnessTurn t = turns.findForUpdate(id).orElseThrow();
        if (t.getStatus() != TurnStatus.PREPARING) return false;
        t.setStatus(TurnStatus.READY);
        t.setExpiresAt(Instant.now().plus(ttl));
        turns.save(t);
        return true;
    }

    /** FINALIZING → READY/GENERATING with attempt + 1 (HARNESS.md §8.5). */
    @Transactional
    public boolean retry(UUID id, int attempt, GenerationSide side, Duration ttl) {
        HarnessTurn t = turns.findForUpdate(id).orElseThrow();
        if (t.getStatus() != TurnStatus.FINALIZING) return false;
        t.setStatus(side == GenerationSide.SERVER ? TurnStatus.GENERATING : TurnStatus.READY);
        t.setAttempt((short) attempt);
        t.setExpiresAt(Instant.now().plus(ttl));
        turns.save(t);
        return true;
    }

    // ------------------------------------------------------------------ MESSAGE task handler (§7.6)

    /**
     * Save the assistant message and end the turn, all under the turn's row lock.
     * @return the saved message, or null when the turn was no longer in an expected status
     */
    @Transactional
    public MessageDto applyMessage(UUID turnId, Collection<TurnStatus> expected, TurnStatus terminal,
                                   MessageResult r, JsonNode contextOverride) {
        HarnessTurn t = turns.findForUpdate(turnId).orElseThrow();
        if (!expected.contains(t.getStatus())) return null;
        JsonNode ctx = contextOverride != null ? contextOverride : t.getPrepareContext();
        if (contextOverride != null) t.setPrepareContext(contextOverride);
        Chat chat = chats.findForUpdate(t.getChatId()).orElseThrow();
        Message user = messages.findById(t.getUserMessageId()).orElseThrow();

        Message a = messages.save(Message.builder().chatId(chat.getId()).parentId(user.getId())
                .role(MessageRole.ASSISTANT).content(r.content()).originalContent(r.originalContent())
                .translations(r.translations() == null || r.translations().isNull() ? json.createObjectNode()
                        : r.translations())
                .status(r.status()).meta(assistantMeta(t, ctx, r)).turnId(t.getId()).build());

        if (ctx != null && ctx.hasNonNull("modelInput") && user.getMeta() instanceof ObjectNode um) {
            String mi = ctx.get("modelInput").asString();
            if (!mi.equals(user.getContent())) user.setModelInput(mi);
            ObjectNode copy = um.deepCopy();
            copy.put("inputLanguage", ctx.path("inputLanguage").asString(null));
            user.setMeta(copy);
            messages.save(user);
        }
        chat.setActiveLeafId(a.getId());
        chat.setLastMessagePreview(preview(a.getContent()));
        chat.setUpdatedAt(Instant.now());
        if (chat.getTitleSource() == TitleSource.DEFAULT) {
            String title = autoTitle(chat.getId());
            if (title != null) {
                chat.setTitle(title);
                chat.setTitleSource(TitleSource.AUTO);
            }
        }
        chats.save(chat);

        t.setStatus(terminal);
        t.setResultMessageId(a.getId());
        t.setCompletedAt(Instant.now());
        turns.save(t);
        return mapper.toDto(a);
    }

    private JsonNode assistantMeta(HarnessTurn t, JsonNode ctx, MessageResult r) {
        ObjectNode m = json.createObjectNode().put("task", t.getTask().name());
        m.put("pipeline", ctx == null ? null : ctx.path("pipeline").asString(null));
        m.put("providerKind", t.getProviderKind().name());
        m.put("model", t.getModel());
        m.put("outputLanguage", ctx == null ? "EN" : ctx.path("outputLanguage").asString("EN"));
        m.putNull("inputLanguage");
        ArrayNode sources = m.putArray("sources");
        if (ctx != null) {
            for (JsonNode s : ctx.path("sources")) {
                ObjectNode copy = (ObjectNode) s.deepCopy();
                copy.remove(List.of("text", "chunkEmbeddingAvailable"));
                String snippet = copy.path("snippet").asString("");
                if (snippet.length() > 300) copy.put("snippet", snippet.substring(0, 300));
                sources.add(copy);
            }
        }
        m.set("grounding", r.grounding() == null ? json.nullNode() : r.grounding());
        m.set("guard", r.guard() == null ? json.nullNode() : r.guard());
        m.set("tools", ctx == null ? json.createArrayNode() : ctx.path("tools").isArray() ? ctx.get("tools")
                : json.createArrayNode());
        m.set("suggestions", r.suggestions() == null || r.suggestions().isNull() ? json.createArrayNode()
                : r.suggestions());
        m.set("stats", r.stats() == null ? json.nullNode() : stats(r.stats()));
        m.put("finishReason", r.finishReason());
        return m;
    }

    private JsonNode stats(JsonNode s) {
        ObjectNode o = json.createObjectNode();
        for (String k : List.of("ttftMs", "tokensPerSec", "outputTokens", "promptTokens", "totalMs")) {
            o.set(k, s.hasNonNull(k) ? s.get(k) : json.nullNode());
        }
        return o;
    }

    /** First 6 words of the first user message, trailing punctuation removed, ≤ 60 chars (HARNESS.md §9.2). */
    private String autoTitle(UUID chatId) {
        return messages.findByChatIdOrderByCreatedAtAsc(chatId, Limit.of(50)).stream()
                .filter(m -> m.getRole() == MessageRole.USER).findFirst()
                .map(m -> {
                    String[] words = m.getContent().strip().split("\\s+");
                    String t = String.join(" ", Arrays.copyOf(words, Math.min(6, words.length)));
                    t = t.replaceAll("[\\p{Punct}\\s។៕]+$", "");
                    return t.length() > 60 ? t.substring(0, 60).strip() : t;
                })
                .filter(s -> !s.isBlank()).orElse(null);
    }

    private static List<String> names(TurnStatus... s) {
        return Arrays.stream(s).map(Enum::name).toList();
    }
}
