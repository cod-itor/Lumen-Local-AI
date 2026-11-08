package com.learnai.service.impl;

import com.learnai.dto.request.ProjectRequest;
import com.learnai.dto.response.ProjectDto;
import com.learnai.entity.Project;
import com.learnai.exception.ApiException;
import com.learnai.repository.ChatRepository;
import com.learnai.repository.ProjectRepository;
import com.learnai.service.ProjectService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectServiceImpl implements ProjectService {

    static final int MAX_PROJECTS = 100;

    private final ProjectRepository projects;
    private final ChatRepository chats;

    @Override
    @Transactional(readOnly = true)
    public List<ProjectDto> list(UUID userId) {
        return projects.findByUserIdOrderByUpdatedAtDesc(userId).stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public ProjectDto create(UUID userId, ProjectRequest r) {
        if (projects.countByUserId(userId) >= MAX_PROJECTS) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "QUOTA_EXCEEDED", "You can have at most 100 projects.");
        }
        return toDto(projects.saveAndFlush(Project.builder().userId(userId).name(r.name().trim()).build()));
    }

    @Override
    @Transactional
    public ProjectDto rename(UUID userId, UUID projectId, ProjectRequest r) {
        Project p = owned(userId, projectId);
        p.setName(r.name().trim());
        return toDto(projects.saveAndFlush(p));
    }

    @Override
    @Transactional
    public void delete(UUID userId, UUID projectId) {
        projects.delete(owned(userId, projectId)); // its chats stay (project_id → null)
    }

    private Project owned(UUID userId, UUID projectId) {
        return projects.findByIdAndUserId(projectId, userId).orElseThrow(() -> ApiException.notFound("project"));
    }

    private ProjectDto toDto(Project p) {
        return new ProjectDto(p.getId(), p.getName(), chats.countByUserIdAndProjectId(p.getUserId(), p.getId()),
                p.getCreatedAt(), p.getUpdatedAt());
    }
}
