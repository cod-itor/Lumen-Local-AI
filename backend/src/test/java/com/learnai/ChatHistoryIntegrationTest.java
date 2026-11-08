package com.learnai;

import com.learnai.entity.Message;
import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.MessageStatus;
import com.learnai.harness.HistoryBuilder;
import com.learnai.repository.MessageRepository;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import tools.jackson.databind.ObjectMapper;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 3: chats API, JSONB message rows and HARNESS.md §7.5 steps 1–3. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = {
        "JWT_SECRET=test-secret-test-secret-test-secret-0123456789",
        "AI_SERVICE_TOKEN=test", "STORAGE_DIR=target/test-storage", "PUBLIC_URL=http://localhost:3000",
        "AI_SERVICE_URL=http://127.0.0.1:9", "spring.config.import="})
class ChatHistoryIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))
            .withUrlParam("stringtype", "unspecified");

    private static final String ORIGIN = "http://localhost:3000";

    @Autowired MockMvc mvc;
    @Autowired MessageRepository messages;
    @Autowired HistoryBuilder history;
    @Autowired ObjectMapper json;

    @Test
    void chatsAndHistory() throws Exception {
        Cookie access = mvc.perform(post("/api/auth/register").header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Sok\",\"email\":\"sok@example.com\",\"password\":\"study2026\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getCookie("access_token");

        String body = mvc.perform(post("/api/chats").cookie(access).header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tab\":\"CHAT\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("New chat"))
                .andExpect(jsonPath("$.titleSource").value("DEFAULT"))
                .andReturn().getResponse().getContentAsString();
        UUID chatId = UUID.fromString(json.readTree(body).get("id").asString());

        Message u1 = save(chatId, null, MessageRole.USER, "What is 2+2?", MessageStatus.COMPLETE, null);
        Message a1 = save(chatId, u1.getId(), MessageRole.ASSISTANT, "It is 4 [1].", MessageStatus.COMPLETE, null);
        Message u2 = save(chatId, a1.getId(), MessageRole.USER, "bad question", MessageStatus.COMPLETE, null);
        Message a2 = save(chatId, u2.getId(), MessageRole.ASSISTANT, "refused", MessageStatus.BLOCKED, null);
        Message u3 = save(chatId, a2.getId(), MessageRole.USER, "សួស្តី", MessageStatus.COMPLETE, "Hello");

        HistoryBuilder.History h = history.build(chatId, u3.getId());
        assertThat(h.messages()).hasSize(2);
        assertThat(h.messages().get(1).get("content")).isEqualTo("It is 4 [1].");
        assertThat(h.previousUserMessage()).isEqualTo("Hello");

        mvc.perform(get("/api/chats/" + chatId + "/messages").cookie(access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.messages.length()").value(5))
                .andExpect(jsonPath("$.messages[0].meta.feedback").isEmpty());
        mvc.perform(patch("/api/chats/" + chatId).cookie(access).header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"title\":\"Maths\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.titleSource").value("USER"));
        mvc.perform(get("/api/chats?tab=CHAT").cookie(access))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items[0].title").value("Maths"));
        mvc.perform(get("/api/chats/" + UUID.randomUUID()).cookie(access)).andExpect(status().isNotFound());
        // the AI service is not running in this test: providers list is empty, not an error
        mvc.perform(get("/api/providers").cookie(access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    private Message save(UUID chatId, UUID parent, MessageRole role, String content, MessageStatus st, String modelInput) {
        return messages.saveAndFlush(Message.builder().chatId(chatId).parentId(parent).role(role).content(content)
                .modelInput(modelInput).status(st).translations(json.createObjectNode())
                .meta(json.createObjectNode().put("task", "MESSAGE")).build());
    }
}
