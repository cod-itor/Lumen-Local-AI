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
import tools.jackson.databind.JsonNode;

import java.time.Instant;
import java.util.UUID;

/** The grade of one case in a run; an error result (error != null) counts as failed and can be replaced. */
@Entity
@Table(name = "eval_results")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EvalResult {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "case_id", nullable = false, length = 80)
    private String caseId;

    @Column(nullable = false, length = 20)
    private String category;

    @Column(nullable = false)
    private boolean passed;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode checks;

    @Column(nullable = false, columnDefinition = "text")
    private String output;

    @Column(name = "guard_would_block", nullable = false)
    private boolean guardWouldBlock;

    @Convert(converter = JsonNodeConverter.class)
    @Column(columnDefinition = "jsonb")
    private JsonNode stats;

    @Column(length = 40)
    private String error;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
