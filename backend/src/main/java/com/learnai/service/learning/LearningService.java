package com.learnai.service.learning;

import com.learnai.client.AiServiceClient;
import com.learnai.dto.request.LearningRequests;
import com.learnai.dto.response.LearningDtos.LearningPathDto;
import com.learnai.dto.response.LearningDtos.LearningStepDto;
import com.learnai.dto.response.LearningDtos.QuizDto;
import com.learnai.dto.response.LearningDtos.QuizItemResult;
import com.learnai.dto.response.LearningDtos.QuizResultDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.entity.LearningPath;
import com.learnai.entity.LearningStep;
import com.learnai.entity.Quiz;
import com.learnai.entity.QuizAttempt;
import com.learnai.entity.UserSettings;
import com.learnai.entity.enums.ContentStatus;
import com.learnai.entity.enums.LearningPathState;
import com.learnai.entity.enums.StepStatus;
import com.learnai.exception.ApiException;
import com.learnai.harness.TurnContext;
import com.learnai.repository.HarnessTurnRepository;
import com.learnai.repository.LearningPathRepository;
import com.learnai.repository.LearningStepRepository;
import com.learnai.repository.QuizAttemptRepository;
import com.learnai.repository.QuizRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Learning paths and quizzes (BACKEND.md §9.9, API_CONTRACT §6.9). */
@Service
@RequiredArgsConstructor
public class LearningService {

    private final LearningPathRepository paths;
    private final LearningStepRepository steps;
    private final QuizRepository quizzes;
    private final QuizAttemptRepository attempts;
    private final HarnessTurnRepository turns;
    private final LearningMapper mapper;
    private final AiServiceClient ai;
    private final TurnContext ctx;
    private final ObjectMapper json;

    @Transactional(readOnly = true)
    public PageResponse<LearningPathDto> list(UUID userId, int page, int size) {
        var p = paths.findByUserIdOrderByUpdatedAtDesc(userId, PageRequest.of(Math.max(0, page),
                Math.min(Math.max(1, size), 50)));
        return PageResponse.of(p, mapper::path);
    }

    @Transactional
    public LearningPathDto create(UUID userId, LearningRequests.CreatePath r) {
        String goal = r.goal().strip();
        UserSettings s = ctx.settings(userId);
        JsonNode g = ai.guardCheck(goal, "TEXT", s.getGuardProfile().name());
        String action = g.path("action").asString("ALLOW");
        if ("BLOCK".equals(action) || "SUPPORT".equals(action)) {
            JsonNode refusal = g.path("refusal");
            String text = refusal.isObject() ? refusal.path("EN").asString("") : refusal.asString("");
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("action", action);
            details.put("category", g.path("categories").path(0).asString(null));
            details.put("refusal", text);
            throw new ApiException(HttpStatus.BAD_REQUEST, "GUARD_BLOCKED", text, details);
        }
        LearningPath p = paths.saveAndFlush(LearningPath.builder().userId(userId).goal(goal)
                .state(LearningPathState.INTERVIEWING).interview(json.createArrayNode()).build());
        return mapper.path(p, List.of());
    }

    @Transactional(readOnly = true)
    public LearningPathDto get(UUID userId, UUID id) {
        return mapper.path(owned(userId, id));
    }

    @Transactional
    public void delete(UUID userId, UUID id) {
        LearningPath p = lockedFree(userId, id);
        paths.delete(p);
    }

    @Transactional
    public LearningPathDto answer(UUID userId, UUID id, LearningRequests.Answer r) {
        LearningPath p = lockedFree(userId, id);
        if (p.getState() != LearningPathState.INTERVIEWING || !LearningRules.hasPending(p)) {
            throw conflict(p, "There is no question waiting for an answer.");
        }
        ArrayNode iv = (ArrayNode) p.getInterview().deepCopy();
        String a = r.answer().strip();
        ((ObjectNode) iv.get(iv.size() - 1)).put("answer", a.length() > 300 ? a.substring(0, 300) : a);
        p.setInterview(iv);
        if (LearningRules.interviewDone(p)) p.setState(LearningPathState.PLANNING);
        return mapper.path(paths.save(p), List.of());
    }

    @Transactional
    public LearningPathDto skipInterview(UUID userId, UUID id) {
        LearningPath p = lockedFree(userId, id);
        if (p.getState() != LearningPathState.INTERVIEWING) throw conflict(p, "The interview is already over.");
        // A question left without an answer is dropped so the plan only sees real answers.
        if (LearningRules.hasPending(p)) {
            ArrayNode iv = (ArrayNode) p.getInterview().deepCopy();
            iv.remove(iv.size() - 1);
            p.setInterview(iv);
        }
        p.setState(LearningPathState.PLANNING);
        return mapper.path(paths.save(p), List.of());
    }

    @Transactional
    public LearningPathDto putPlan(UUID userId, UUID id, LearningRequests.PutPlan r) {
        LearningPath p = lockedFree(userId, id);
        if (p.getState() != LearningPathState.AWAITING_APPROVAL) throw conflict(p, "This plan can't be changed now.");
        LearningRules.validatePlan(r.plan());
        p.setPlan(clean(r.plan()));
        return mapper.path(paths.save(p), List.of());
    }

    @Transactional
    public LearningPathDto approve(UUID userId, UUID id) {
        LearningPath p = lockedFree(userId, id);
        if (p.getState() != LearningPathState.AWAITING_APPROVAL || p.getPlan() == null) {
            throw conflict(p, "There is no plan waiting for approval.");
        }
        steps.deleteByPathId(p.getId());
        List<LearningStep> created = new ArrayList<>();
        short pos = 1;
        for (JsonNode s : p.getPlan().path("steps")) {
            created.add(LearningStep.builder().pathId(p.getId()).position(pos)
                    .title(cut(s.path("title").asString(""), 120)).summary(cut(s.path("summary").asString(""), 500))
                    .objectives(s.path("objectives").deepCopy()).contentStatus(ContentStatus.EMPTY)
                    .status(pos == 1 ? StepStatus.CURRENT : StepStatus.LOCKED).build());
            pos++;
        }
        created = steps.saveAll(created);
        p.setState(LearningPathState.ACTIVE);
        return mapper.path(paths.save(p), created);
    }

    @Transactional
    public LearningPathDto restart(UUID userId, UUID id) {
        LearningPath p = lockedFree(userId, id);
        steps.deleteByPathId(p.getId());
        p = paths.findForUpdate(id).orElseThrow();
        p.setInterview(json.createArrayNode());
        p.setPlan(null);
        p.setState(LearningPathState.INTERVIEWING);
        return mapper.path(paths.save(p), List.of());
    }

    @Transactional(readOnly = true)
    public LearningStepDto step(UUID userId, UUID stepId) {
        return mapper.step(ownedStep(userId, stepId));
    }

    @Transactional(readOnly = true)
    public List<QuizDto> quizzesOf(UUID userId, UUID stepId) {
        ownedStep(userId, stepId);
        return quizzes.findByStepIdOrderByCreatedAtDesc(stepId).stream().map(mapper::quiz).toList();
    }

    /** Grade, store the attempt, keep the best score, unlock the next step at ≥ 0.7 (BACKEND.md §9.9). */
    @Transactional
    public QuizResultDto submit(UUID userId, UUID quizId, LearningRequests.SubmitQuiz r) {
        Quiz q = quizzes.findByIdAndUserId(quizId, userId).orElseThrow(() -> ApiException.notFound("quiz"));
        JsonNode qs = q.getQuestions();
        if (r.answers().size() != qs.size()) {
            throw ApiException.validation("answers", "Answer every question (" + qs.size() + " answers).");
        }
        LearningStep step = steps.findById(q.getStepId()).orElseThrow(() -> ApiException.notFound("step"));
        LearningPath p = paths.findForUpdate(step.getPathId()).orElseThrow(() -> ApiException.notFound("path"));
        step = steps.findById(step.getId()).orElseThrow();
        List<QuizItemResult> results = new ArrayList<>();
        int correct = 0;
        for (int i = 0; i < qs.size(); i++) {
            JsonNode item = qs.get(i);
            Integer sel = r.answers().get(i);
            int right = item.path("answerIndex").asInt(-1);
            boolean ok = sel != null && sel == right;
            if (ok) correct++;
            results.add(new QuizItemResult(i, sel, right, ok, item.path("explanation").asString(""),
                    item.path("evidence").asString("")));
        }
        double score = qs.isEmpty() ? 0 : (double) correct / qs.size();
        boolean passed = score >= LearningRules.PASS_SCORE;
        attempts.save(QuizAttempt.builder().quizId(q.getId()).userId(userId).answers(json.valueToTree(r.answers()))
                .score((float) score).passed(passed).build());
        if (step.getBestScore() == null || score > step.getBestScore()) step.setBestScore((float) score);
        LearningStep next = null;
        if (passed && step.getStatus() == StepStatus.CURRENT) {
            step.setStatus(StepStatus.DONE);
            for (LearningStep s : steps.findByPathIdOrderByPosition(p.getId())) {
                if (s.getPosition() > step.getPosition() && s.getStatus() == StepStatus.LOCKED) {
                    next = s;
                    break;
                }
            }
            if (next != null) {
                next.setStatus(StepStatus.CURRENT);
                steps.save(next);
            } else if (steps.findByPathIdOrderByPosition(p.getId()).stream()
                    .allMatch(s -> s.getStatus() == StepStatus.DONE || s.getId().equals(q.getStepId()))) {
                p.setState(LearningPathState.COMPLETED);
            }
        }
        steps.save(step);
        p.setUpdatedAt(java.time.Instant.now());
        paths.save(p);
        return new QuizResultDto(q.getId(), score, passed, results, mapper.step(step), mapper.step(next));
    }

    // ------------------------------------------------------------------ helpers

    LearningPath owned(UUID userId, UUID id) {
        return paths.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("learning path"));
    }

    LearningStep ownedStep(UUID userId, UUID stepId) {
        LearningStep s = steps.findById(stepId).orElseThrow(() -> ApiException.notFound("learning step"));
        owned(userId, s.getPathId());
        return s;
    }

    /** Owned, row-locked, and no open harness turn holds `path:{id}`. */
    private LearningPath lockedFree(UUID userId, UUID id) {
        owned(userId, id);
        LearningPath p = paths.findForUpdate(id).orElseThrow(() -> ApiException.notFound("learning path"));
        if (!turns.findOpenByLockKey("path:" + id).isEmpty()) {
            throw new ApiException(HttpStatus.CONFLICT, "CONFLICT", "Another request for this item is still running.",
                    Map.of("currentState", p.getState().name()));
        }
        return p;
    }

    private static ApiException conflict(LearningPath p, String message) {
        return new ApiException(HttpStatus.CONFLICT, "CONFLICT", message, Map.of("currentState", p.getState().name()));
    }

    private JsonNode clean(JsonNode plan) {
        ObjectNode o = json.createObjectNode().put("title", plan.path("title").asString("").strip())
                .put("level", plan.path("level").asString());
        ArrayNode arr = o.putArray("steps");
        for (JsonNode s : plan.path("steps")) {
            ObjectNode st = arr.addObject().put("title", s.path("title").asString("").strip())
                    .put("summary", s.path("summary").asString("").strip());
            ArrayNode obj = st.putArray("objectives");
            for (JsonNode x : s.path("objectives")) obj.add(x.asString("").strip());
        }
        return o;
    }

    private static String cut(String s, int max) {
        s = s.strip();
        return s.length() > max ? s.substring(0, max) : s;
    }
}
