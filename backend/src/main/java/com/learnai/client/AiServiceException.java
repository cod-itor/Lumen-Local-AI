package com.learnai.client;

import com.learnai.exception.ApiException;
import lombok.Getter;
import org.springframework.http.HttpStatus;

/** An AI service failure mapped to an API error (BACKEND.md §8). */
@Getter
public class AiServiceException extends ApiException {

    private final boolean retryable;

    public AiServiceException(HttpStatus status, String code, String message, boolean retryable) {
        super(status, code, message);
        this.retryable = retryable;
    }

    public static AiServiceException unavailable() {
        return new AiServiceException(HttpStatus.SERVICE_UNAVAILABLE, "AI_SERVICE_UNAVAILABLE",
                "The AI service is not available right now.", true);
    }

    public static AiServiceException timeout() {
        return new AiServiceException(HttpStatus.GATEWAY_TIMEOUT, "AI_TIMEOUT", "The AI service took too long.", true);
    }
}
