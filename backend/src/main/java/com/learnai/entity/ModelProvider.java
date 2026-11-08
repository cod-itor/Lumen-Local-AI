package com.learnai.entity;

import com.learnai.entity.enums.ProviderKind;
import com.learnai.entity.enums.ProviderStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "model_providers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ModelProvider {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 60)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 12)
    private ProviderKind kind;

    @Column(name = "base_url", length = 500)
    private String baseUrl;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "api_key_encrypted")
    private byte[] apiKeyEncrypted;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "model_profile", nullable = false, columnDefinition = "jsonb")
    private JsonNode modelProfile;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "profile_overrides", nullable = false, columnDefinition = "jsonb")
    private JsonNode profileOverrides;

    @Column(name = "profile_rules_version", length = 40)
    private String profileRulesVersion;

    @Column(name = "is_default", nullable = false)
    private boolean defaultProvider;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    @Builder.Default
    private ProviderStatus status = ProviderStatus.UNTESTED;

    @Column(name = "last_tested_at")
    private Instant lastTestedAt;

    @Column(name = "last_test_message", length = 500)
    private String lastTestMessage;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
