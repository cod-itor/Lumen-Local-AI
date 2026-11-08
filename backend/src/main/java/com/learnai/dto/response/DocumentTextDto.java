package com.learnai.dto.response;

import java.util.UUID;

public record DocumentTextDto(UUID documentId, Integer page, String text, Integer totalPages) {}
