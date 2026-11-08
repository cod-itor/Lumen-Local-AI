package com.learnai.harness.task;

import com.learnai.dto.request.HarnessTurnRequest;
import com.learnai.entity.HarnessTurn;
import com.learnai.entity.enums.Task;
import com.learnai.exception.ApiException;
import com.learnai.repository.ImageSessionRepository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

import java.util.Map;
import java.util.UUID;

/** IMAGE_CLARIFY / IMAGE_PROMPT (BACKEND.md §7.6): nothing stored, no lock. */
abstract class ImageTaskHandler implements TaskHandler {

    protected final ImageSessionRepository sessions;
    protected final ObjectMapper json;

    ImageTaskHandler(ImageSessionRepository sessions, ObjectMapper json) {
        this.sessions = sessions;
        this.json = json;
    }

    @Override
    public Target target(UUID userId, HarnessTurnRequest r) {
        if (r.target() == null || !"IMAGE_SESSION".equals(r.target().type())) {
            throw ApiException.validation("target", "This task needs target { type: IMAGE_SESSION, id }.");
        }
        sessions.findByIdAndUserId(r.target().id(), userId).orElseThrow(() -> ApiException.notFound("image session"));
        Map<String, Object> ti = r.taskInput();
        Object req = ti == null ? null : ti.get("request");
        if (!(req instanceof String s) || s.isBlank() || s.length() > 1000) {
            throw ApiException.validation("taskInput.request", "Describe the image (1–1000 characters).");
        }
        return new Target("IMAGE_SESSION", r.target().id(), null, null);
    }

    protected JsonNode input(HarnessTurn t) {
        return t.getRequest().path("taskInput");
    }

    static final class Clarify extends ImageTaskHandler {
        Clarify(ImageSessionRepository sessions, ObjectMapper json) {
            super(sessions, json);
        }

        @Override
        public Task task() {
            return Task.IMAGE_CLARIFY;
        }

        @Override
        public ObjectNode taskInput(HarnessTurn t) {
            return json.createObjectNode().put("request", input(t).path("request").asString(""));
        }

        @Override
        public Object apply(HarnessTurn t, JsonNode r) {
            return r.path("data");
        }
    }

    static final class Prompt extends ImageTaskHandler {
        Prompt(ImageSessionRepository sessions, ObjectMapper json) {
            super(sessions, json);
        }

        @Override
        public Task task() {
            return Task.IMAGE_PROMPT;
        }

        @Override
        public ObjectNode taskInput(HarnessTurn t) {
            JsonNode in = input(t);
            ObjectNode o = json.createObjectNode().put("request", in.path("request").asString(""));
            o.set("answers", in.path("answers").isObject() ? in.get("answers") : json.createObjectNode());
            if (in.path("style").isString()) o.put("style", in.path("style").asString());
            else o.putNull("style");
            return o;
        }

        @Override
        public Object apply(HarnessTurn t, JsonNode r) {
            String request = input(t).path("request").asString("");
            JsonNode ctx = t.getPrepareContext();
            String english = ctx == null ? request : ctx.path("requestEnglish").asString(request);
            return json.createObjectNode().put("prompt", r.path("data").path("prompt").asString(""))
                    .put("originalPrompt", request).put("originalPromptEnglish", english);
        }
    }
}
