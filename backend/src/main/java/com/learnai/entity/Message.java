package com.learnai.entity;

import com.learnai.entity.enums.MessageRole;
import com.learnai.entity.enums.MessageStatus;
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
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "messages")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "chat_id", nullable = false)
    private UUID chatId;

    @Column(name = "parent_id")
    private UUID parentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 9)
    private MessageRole role;

    @Column(nullable = false, columnDefinition = "text")
    private String content;

    @Column(name = "original_content", columnDefinition = "text")
    private String originalContent;

    @Column(name = "model_input", columnDefinition = "text")
    private String modelInput;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode translations;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 9)
    @Builder.Default
    private MessageStatus status = MessageStatus.COMPLETE;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode meta;

    @Column(name = "turn_id")
    private UUID turnId;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
