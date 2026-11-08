package com.learnai.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/** One row per terminal turn (HARNESS.md §13.1). */
@Entity
@Table(name = "turn_metrics")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TurnMetrics {

    @Id
    @Column(name = "turn_id")
    private UUID turnId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false, length = 16)
    private String task;

    @Column(length = 4)
    private String pipeline;

    @Column(name = "provider_kind", nullable = false, length = 12)
    private String providerKind;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(name = "rules_version", length = 40)
    private String rulesVersion;

    @Column(name = "input_language", length = 5)
    private String inputLanguage;

    @Column(name = "output_language", length = 4)
    private String outputLanguage;

    @Column(name = "estimated_prompt_tokens")
    private Integer estimatedPromptTokens;

    @Column(name = "actual_prompt_tokens")
    private Integer actualPromptTokens;

    @Column(name = "output_tokens")
    private Integer outputTokens;

    @Column(name = "ttft_ms")
    private Integer ttftMs;

    @Column(name = "tokens_per_sec")
    private Float tokensPerSec;

    @Column(name = "total_ms")
    private Integer totalMs;

    @Column(name = "finish_reason", length = 12)
    private String finishReason;

    @Column(name = "guard_input_action", length = 14)
    private String guardInputAction;

    @Column(name = "guard_output_action", length = 14)
    private String guardOutputAction;

    @Column(name = "grounding_level", length = 14)
    private String groundingLevel;

    @Column(name = "supported_ratio")
    private Float supportedRatio;

    @Column(name = "top_sim")
    private Float topSim;

    @Column(name = "chunks_used")
    private Short chunksUsed;

    @Column(name = "abstained_before_model", nullable = false)
    private boolean abstainedBeforeModel;

    @Column(name = "json_attempts")
    private Short jsonAttempts;

    @Column(nullable = false, length = 18)
    private String status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
}
