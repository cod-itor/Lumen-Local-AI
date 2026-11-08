package com.learnai.entity;

import com.learnai.entity.enums.AnswerLength;
import com.learnai.entity.enums.GuardProfile;
import com.learnai.entity.enums.OutputLanguage;
import com.learnai.entity.enums.Theme;
import com.learnai.entity.enums.UiLanguage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_settings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSettings {

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 6)
    @Builder.Default
    private Theme theme = Theme.SYSTEM;

    @Enumerated(EnumType.STRING)
    @Column(name = "ui_language", nullable = false, length = 2)
    @Builder.Default
    private UiLanguage uiLanguage = UiLanguage.EN;

    @Enumerated(EnumType.STRING)
    @Column(name = "output_language", nullable = false, length = 4)
    @Builder.Default
    private OutputLanguage outputLanguage = OutputLanguage.EN;

    @Enumerated(EnumType.STRING)
    @Column(name = "answer_length", nullable = false, length = 8)
    @Builder.Default
    private AnswerLength answerLength = AnswerLength.NORMAL;

    @Column(precision = 3, scale = 2)
    private BigDecimal temperature;

    @Column(name = "ask_before_search", nullable = false)
    @Builder.Default
    private boolean askBeforeSearch = false;

    @Enumerated(EnumType.STRING)
    @Column(name = "guard_profile", nullable = false, length = 8)
    @Builder.Default
    private GuardProfile guardProfile = GuardProfile.STANDARD;

    @Column(nullable = false, length = 64)
    @Builder.Default
    private String timezone = "Asia/Phnom_Penh";

    @Column(name = "show_speed_stats", nullable = false)
    @Builder.Default
    private boolean showSpeedStats = true;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
