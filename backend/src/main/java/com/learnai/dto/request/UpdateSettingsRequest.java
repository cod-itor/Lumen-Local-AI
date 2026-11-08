package com.learnai.dto.request;

import com.learnai.entity.enums.AnswerLength;
import com.learnai.entity.enums.OutputLanguage;
import com.learnai.entity.enums.Theme;
import com.learnai.entity.enums.UiLanguage;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.Optional;
import java.util.UUID;

/**
 * Partial {@code SettingsDto} (PATCH). Absent fields stay unchanged. {@code temperature}: absent = unchanged,
 * JSON {@code null} = back to the mode default (Optional.empty()).
 */
public record UpdateSettingsRequest(
        Theme theme,
        UiLanguage uiLanguage,
        OutputLanguage outputLanguage,
        AnswerLength answerLength,
        Optional<@DecimalMin(value = "0.0", message = "temperature must be 0-1")
                 @DecimalMax(value = "1.0", message = "temperature must be 0-1") Double> temperature,
        Boolean askBeforeSearch,
        @Pattern(regexp = "STANDARD|STRICT", message = "guardProfile must be STANDARD or STRICT") String guardProfile,
        @Size(max = 64) String timezone,
        Boolean showSpeedStats,
        UUID defaultProviderId) {
}
