package com.learnai.entity;

import com.learnai.entity.enums.ContentStatus;
import com.learnai.entity.enums.StepStatus;
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
import tools.jackson.databind.JsonNode;

import java.util.UUID;

@Entity
@Table(name = "learning_steps")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LearningStep {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "path_id", nullable = false)
    private UUID pathId;

    @Column(nullable = false)
    private Short position;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(nullable = false, length = 500)
    private String summary;

    @Convert(converter = JsonNodeConverter.class)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode objectives;

    @Column(columnDefinition = "text")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "content_status", nullable = false, length = 6)
    private ContentStatus contentStatus;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 7)
    private StepStatus status;

    @Column(name = "best_score")
    private Float bestScore;
}
