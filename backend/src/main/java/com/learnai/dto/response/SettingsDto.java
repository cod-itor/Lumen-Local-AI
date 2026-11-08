package com.learnai.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.learnai.entity.enums.AnswerLength;
import com.learnai.entity.enums.OutputLanguage;
import com.learnai.entity.enums.Theme;
import com.learnai.entity.enums.UiLanguage;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.ALWAYS)
public record SettingsDto(Theme theme, UiLanguage uiLanguage, OutputLanguage outputLanguage, AnswerLength answerLength,
                          Double temperature, boolean askBeforeSearch, String guardProfile, String timezone,
                          boolean showSpeedStats, UUID defaultProviderId) {
}
