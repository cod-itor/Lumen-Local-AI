package com.learnai.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.Map;

/** Any expected API error; rendered as the API_CONTRACT §3 body by {@link GlobalExceptionHandler}. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final transient Map<String, Object> details;
    private final transient Map<String, String> headers;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, null, null);
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, Object> details) {
        this(status, code, message, details, null);
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, Object> details,
                        Map<String, String> headers) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.headers = headers;
    }

    public static ApiException notFound(String resource) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "Not found.", Map.of("resource", resource));
    }

    public static ApiException validation(String field, String reason) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", reason,
                Map.of("fields", Map.of(field, reason)));
    }

    public static ApiException unauthenticated() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please log in again.");
    }
}
