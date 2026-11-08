package com.learnai.service;

import com.learnai.dto.request.ProjectRequest;
import com.learnai.dto.response.ProjectDto;

import java.util.List;
import java.util.UUID;

public interface ProjectService {

    List<ProjectDto> list(UUID userId);

    ProjectDto create(UUID userId, ProjectRequest request);

    ProjectDto rename(UUID userId, UUID projectId, ProjectRequest request);

    void delete(UUID userId, UUID projectId);
}
