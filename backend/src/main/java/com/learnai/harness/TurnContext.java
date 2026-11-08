package com.learnai.harness;

import com.learnai.config.AppProperties;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.ModelProvider;
import com.learnai.entity.UserSettings;
import com.learnai.entity.enums.GuardProfile;
import com.learnai.entity.enums.Task;
import com.learnai.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.time.Instant;
import java.util.UUID;

/** Builds the `user` and `provider` blocks of internal AI requests (AI_SERVICE.md §4.2). */
@Component
@RequiredArgsConstructor
public class TurnContext {

    private final UserSettingsRepository settings;
    private final ObjectMapper json;
    private final AppProperties props;

    public UserSettings settings(UUID userId) {
        return settings.findById(userId).orElseGet(UserSettings::new);
    }

    public String outputLanguage(HarnessTurn t, UserSettings s) {
        JsonNode r = t.getRequest().path("outputLanguage");
        return r.isString() ? r.asString() : s.getOutputLanguage().name();
    }

    public GuardProfile guardProfile(HarnessTurn t, UserSettings s) {
        if (t.getTask() == Task.EVAL_CASE) return GuardProfile.TEST;
        if (props.harness().forceStrictProfile()) return GuardProfile.STRICT;
        return s.getGuardProfile();
    }

    public ObjectNode user(HarnessTurn t) {
        UserSettings s = settings(t.getUserId());
        ObjectNode u = json.createObjectNode()
                .put("id", t.getUserId().toString())
                .put("timezone", s.getTimezone())
                .put("now", Instant.now().toString())
                .put("outputLanguage", outputLanguage(t, s))
                .put("answerLength", s.getAnswerLength().name())
                .put("guardProfile", guardProfile(t, s).name())
                .put("askBeforeSearch", s.isAskBeforeSearch());
        if (s.getTemperature() == null) u.putNull("temperature");
        else u.put("temperature", s.getTemperature().doubleValue());
        return u;
    }

    public ObjectNode provider(ModelProvider p) {
        ObjectNode o = json.createObjectNode().put("kind", p.getKind().name()).put("model", p.getModel());
        o.set("profile", p.getModelProfile());
        return o;
    }
}
