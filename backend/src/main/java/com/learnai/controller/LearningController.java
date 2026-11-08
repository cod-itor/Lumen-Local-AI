package com.learnai.controller;

import com.learnai.dto.request.LearningRequests;
import com.learnai.dto.response.LearningDtos.LearningPathDto;
import com.learnai.dto.response.LearningDtos.LearningStepDto;
import com.learnai.dto.response.LearningDtos.QuizDto;
import com.learnai.dto.response.LearningDtos.QuizResultDto;
import com.learnai.dto.response.PageResponse;
import com.learnai.security.CurrentUser;
import com.learnai.service.learning.LearningService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** API_CONTRACT §6.9. The model work (questions, plan, lessons, quizzes) runs as harness tasks. */
@Tag(name = "Learning")
@RestController
@RequiredArgsConstructor
public class LearningController {

    private final LearningService learning;

    @GetMapping("/api/learning-paths")
    public PageResponse<LearningPathDto> list(@AuthenticationPrincipal CurrentUser user,
                                              @RequestParam(defaultValue = "0") int page,
                                              @RequestParam(defaultValue = "20") int size) {
        return learning.list(user.id(), page, size);
    }

    @PostMapping("/api/learning-paths")
    @ResponseStatus(HttpStatus.CREATED)
    public LearningPathDto create(@AuthenticationPrincipal CurrentUser user,
                                  @Valid @RequestBody LearningRequests.CreatePath body) {
        return learning.create(user.id(), body);
    }

    @GetMapping("/api/learning-paths/{id}")
    public LearningPathDto get(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.get(user.id(), id);
    }

    @DeleteMapping("/api/learning-paths/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        learning.delete(user.id(), id);
    }

    @PostMapping("/api/learning-paths/{id}/answers")
    public LearningPathDto answer(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                  @Valid @RequestBody LearningRequests.Answer body) {
        return learning.answer(user.id(), id, body);
    }

    @PostMapping("/api/learning-paths/{id}/skip-interview")
    public LearningPathDto skip(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.skipInterview(user.id(), id);
    }

    @PutMapping("/api/learning-paths/{id}/plan")
    public LearningPathDto plan(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                @Valid @RequestBody LearningRequests.PutPlan body) {
        return learning.putPlan(user.id(), id, body);
    }

    @PostMapping("/api/learning-paths/{id}/approve")
    public LearningPathDto approve(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.approve(user.id(), id);
    }

    @PostMapping("/api/learning-paths/{id}/restart")
    public LearningPathDto restart(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.restart(user.id(), id);
    }

    @GetMapping("/api/learning-steps/{id}")
    public LearningStepDto step(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.step(user.id(), id);
    }

    @GetMapping("/api/learning-steps/{id}/quizzes")
    public List<QuizDto> quizzes(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        return learning.quizzesOf(user.id(), id);
    }

    @PostMapping("/api/quizzes/{id}/submit")
    public QuizResultDto submit(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                                @Valid @RequestBody LearningRequests.SubmitQuiz body) {
        return learning.submit(user.id(), id, body);
    }
}
