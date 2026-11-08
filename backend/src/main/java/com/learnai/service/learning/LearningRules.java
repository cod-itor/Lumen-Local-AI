package com.learnai.service.learning;

import com.learnai.entity.LearningPath;
import com.learnai.exception.ApiException;
import tools.jackson.databind.JsonNode;

import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/** State rules of API_CONTRACT §6.9 and plan checks of BACKEND.md §9.9. */
public final class LearningRules {

    public static final int MAX_QUESTIONS = 5;
    public static final double PASS_SCORE = 0.7;

    private LearningRules() {}

    public static boolean hasPending(LearningPath p) {
        JsonNode iv = p.getInterview();
        return iv != null && iv.size() > 0 && iv.get(iv.size() - 1).path("answer").isNull();
    }

    public static String nextAction(LearningPath p) {
        return switch (p.getState()) {
            case INTERVIEWING -> hasPending(p) ? "NONE" : "ASK";
            case PLANNING -> "PLAN";
            case AWAITING_APPROVAL -> "APPROVE";
            case ACTIVE -> "STUDY";
            case COMPLETED -> "NONE";
        };
    }

    /** level, outcome and time answered, or 5 questions asked. */
    public static boolean interviewDone(LearningPath p) {
        Set<String> answered = new HashSet<>();
        for (JsonNode it : p.getInterview()) {
            if (it.path("answer").isString()) answered.add(it.path("topic").asString());
        }
        return answered.containsAll(Set.of("level", "outcome", "time")) || p.getInterview().size() >= MAX_QUESTIONS;
    }

    /** 4–8 steps, titles 1–8 words and unique, summary 1–300 chars, 2–4 objectives of 1–150 chars, no links. */
    public static void validatePlan(JsonNode plan) {
        if (plan == null || !plan.isObject()) throw bad("plan", "The plan is missing.");
        String title = plan.path("title").asString("").strip();
        if (title.isEmpty() || title.length() > 120) throw bad("plan.title", "Give the plan a title (up to 120 characters).");
        String level = plan.path("level").asString("");
        if (!Set.of("BEGINNER", "INTERMEDIATE", "ADVANCED").contains(level)) {
            throw bad("plan.level", "Level must be BEGINNER, INTERMEDIATE or ADVANCED.");
        }
        JsonNode steps = plan.path("steps");
        if (!steps.isArray() || steps.size() < 4 || steps.size() > 8) throw bad("plan.steps", "A plan needs 4 to 8 steps.");
        Set<String> seen = new HashSet<>();
        for (int i = 0; i < steps.size(); i++) {
            JsonNode s = steps.get(i);
            String f = "plan.steps[" + i + "]";
            String t = s.path("title").asString("").strip();
            int words = t.isEmpty() ? 0 : t.split("\\s+").length;
            if (words < 1 || words > 8) throw bad(f + ".title", "Step titles need 1 to 8 words.");
            if (!seen.add(t.toLowerCase(Locale.ROOT))) throw bad(f + ".title", "Step titles must be different.");
            String summary = s.path("summary").asString("").strip();
            if (summary.isEmpty() || summary.length() > 300) throw bad(f + ".summary", "Summaries need 1 to 300 characters.");
            JsonNode obj = s.path("objectives");
            if (!obj.isArray() || obj.size() < 2 || obj.size() > 4) throw bad(f + ".objectives", "Each step needs 2 to 4 objectives.");
            for (JsonNode o : obj) {
                String v = o.asString("").strip();
                if (v.isEmpty() || v.length() > 150) throw bad(f + ".objectives", "Objectives need 1 to 150 characters.");
            }
        }
        String all = plan.toString().toLowerCase(Locale.ROOT);
        if (all.contains("http") || all.contains("www.")) throw bad("plan", "Plans cannot contain links.");
    }

    private static ApiException bad(String field, String reason) {
        return ApiException.validation(field, reason);
    }
}
