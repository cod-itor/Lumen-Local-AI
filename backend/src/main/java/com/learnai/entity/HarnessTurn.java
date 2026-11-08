package com.learnai.entity;

import com.learnai.entity.enums.GenerationSide;
import com.learnai.entity.enums.ProviderKind;
import com.learnai.entity.enums.Task;
import com.learnai.entity.enums.TurnStatus;
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
@Table(name = "harness_turns")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HarnessTurn {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "chat_id")
    private UUID chatId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Task task;

    @Column(name = "target_type", length = 16)
    private String targetType;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "lock_key", length = 80)
    private String lockKey;

    @Column(name = "provider_id")
    private UUID providerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_kind", nullable = false, length = 12)
    private ProviderKind providerKind;

    @Column(nullable = false, length = 100)
    private String model;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    private GenerationSide generation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 18)
    private TurnStatus status;

    @Column(nullable = false)
    @Builder.Default
    private Short attempt = 1;

    @Column(name = "user_message_id")
    private UUID userMessageId;

    @Column(name = "result_message_id")
    private UUID resultMessageId;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode request;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "prepare_context", columnDefinition = "jsonb")
    private JsonNode prepareContext;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "prepared_messages", columnDefinition = "jsonb")
    private JsonNode preparedMessages;

    @Column(name = "error_code", length = 40)
    private String errorCode;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "completed_at")
    private Instant completedAt;
}
