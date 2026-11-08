package com.learnai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
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

/** A non-ALLOW guard decision with a masked excerpt (GUARDRAILS.md §11). Written by the backend only. */
@Entity
@Table(name = "guard_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GuardEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "turn_id")
    private UUID turnId;

    @Column(nullable = false, length = 6)
    private String stage;

    @Column(nullable = false, length = 14)
    private String action;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode categories;

    @Column(nullable = false, length = 80)
    private String rule;

    @Column(nullable = false, length = 300)
    private String excerpt;

    @Column(name = "provider_kind", length = 12)
    private String providerKind;

    @Column(length = 100)
    private String model;

    @Column(nullable = false, length = 8)
    private String profile;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
