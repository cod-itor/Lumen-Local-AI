package com.learnai.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.Map;

/** Error body of every non-2xx JSON response (API_CONTRACT §3.1). */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(Instant timestamp, int status, String code, String message, String path,
                            Map<String, Object> details) {
}
