package com.learnai;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Phase 1 acceptance: Flyway V1 + register/login/refresh/reuse/CSRF against a real pgvector Postgres. */
@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@TestPropertySource(properties = {
        "JWT_SECRET=test-secret-test-secret-test-secret-0123456789",
        "AI_SERVICE_TOKEN=test", "STORAGE_DIR=target/test-storage", "PUBLIC_URL=http://localhost:3000",
        "spring.config.import="})
class AuthFlowIntegrationTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))
            .withUrlParam("stringtype", "unspecified");

    private static final String ORIGIN = "http://localhost:3000";

    @Autowired
    MockMvc mvc;

    @Test
    void registerLoginRefreshAndReuseDetection() throws Exception {
        MvcResult reg = mvc.perform(post("/api/auth/register").header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Dara\",\"email\":\"Dara@Example.com\",\"password\":\"study2026\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.user.email").value("dara@example.com"))
                .andExpect(jsonPath("$.user.createdAt").isNotEmpty())
                .andExpect(jsonPath("$.settings.timezone").value("Asia/Phnom_Penh"))
                .andReturn();
        Cookie access = reg.getResponse().getCookie("access_token");
        Cookie refresh = reg.getResponse().getCookie("refresh_token");
        assertThat(reg.getResponse().getCookie("session_hint").getValue()).isEqualTo("1");
        assertThat(refresh.getPath()).isEqualTo("/api/auth");

        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"X\",\"email\":\"dara@example.com\",\"password\":\"study2026\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"dara@example.com\",\"password\":\"wrong-pass1\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        mvc.perform(get("/api/auth/me").cookie(access)).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.name").value("Dara"));
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        mvc.perform(patch("/api/settings").cookie(access).header("Origin", "http://evil.example")
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"DARK\"}"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN_ORIGIN"));
        mvc.perform(patch("/api/settings").cookie(access).header("Origin", ORIGIN)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"theme\":\"DARK\",\"temperature\":0.4}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.theme").value("DARK"))
                .andExpect(jsonPath("$.temperature").value(0.4));

        MvcResult rotated = mvc.perform(post("/api/auth/refresh").cookie(refresh).header("Origin", ORIGIN))
                .andExpect(status().isOk()).andReturn();
        Cookie newRefresh = rotated.getResponse().getCookie("refresh_token");
        assertThat(newRefresh.getValue()).isNotEqualTo(refresh.getValue());

        mvc.perform(post("/api/auth/refresh").cookie(refresh).header("Origin", ORIGIN))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("REFRESH_REUSED"));
        mvc.perform(post("/api/auth/refresh").cookie(newRefresh).header("Origin", ORIGIN))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("REFRESH_INVALID"));
    }
}
