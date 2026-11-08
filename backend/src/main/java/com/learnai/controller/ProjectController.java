package com.learnai.controller;

import com.learnai.dto.request.ProjectRequest;
import com.learnai.dto.response.ProjectDto;
import com.learnai.security.CurrentUser;
import com.learnai.service.ProjectService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/projects")
@RequiredArgsConstructor
@Tag(name = "Projects", description = "Folders of chats in the Chat tab")
public class ProjectController {

    private final ProjectService projects;

    @GetMapping
    public List<ProjectDto> list(@AuthenticationPrincipal CurrentUser user) {
        return projects.list(user.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProjectDto create(@AuthenticationPrincipal CurrentUser user, @Valid @RequestBody ProjectRequest request) {
        return projects.create(user.id(), request);
    }

    @PatchMapping("/{id}")
    public ProjectDto rename(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id,
                             @Valid @RequestBody ProjectRequest request) {
        return projects.rename(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal CurrentUser user, @PathVariable UUID id) {
        projects.delete(user.id(), id);
    }
}
