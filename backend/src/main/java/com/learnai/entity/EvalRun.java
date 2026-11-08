package com.learnai.entity;

import com.learnai.entity.enums.EvalMode;
import com.learnai.entity.enums.EvalRunStatus;
import com.learnai.entity.enums.ProviderKind;
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

/** One Model Test run (HARNESS.md §12, BACKEND.md §9.10). */
@Entity
@Table(name = "eval_runs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvalRun {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "provider_id")
    private UUID providerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider_kind", nullable = false, length = 12)
    private ProviderKind providerKind;

    @Column(nullable = false, length = 100)
    private String model;

    @Column(nullable = false, length = 40)
    private String suite;

    @Column(name = "suite_version", nullable = false)
    private Integer suiteVersion;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private EvalMode mode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 9)
    private EvalRunStatus status;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "case_ids", nullable = false, columnDefinition = "jsonb")
    private JsonNode caseIds;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "case_categories", nullable = false, columnDefinition = "jsonb")
    private JsonNode caseCategories;

    @Column(name = "completed_cases", nullable = false)
    @Builder.Default
    private Integer completedCases = 0;

    private Float score;

    @Convert(converter = JsonNodeConverter.class)
    @Column(name = "category_scores", nullable = false, columnDefinition = "jsonb")
    private JsonNode categoryScores;

    @Column(name = "safety_with_guardrails")
    private Float safetyWithGuardrails;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode speed;

    @Column(name = "rules_version", length = 40)
    private String rulesVersion;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
