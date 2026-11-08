package com.learnai.dto.response;

import java.util.UUID;

public record UploadResponse(DocumentDto document, UUID jobId, boolean duplicate) {}
