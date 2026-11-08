package com.learnai.exception;

import com.learnai.dto.response.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestCookieException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Maps every exception to the API_CONTRACT §3 error body. */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErrorResponse> api(ApiException e, HttpServletRequest req) {
        ResponseEntity.BodyBuilder b = ResponseEntity.status(e.getStatus());
        if (e.getHeaders() != null) e.getHeaders().forEach(b::header);
        return b.body(body(e.getStatus(), e.getCode(), e.getMessage(), req, e.getDetails()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ErrorResponse> invalid(MethodArgumentNotValidException e, HttpServletRequest req) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        String message = fields.values().stream().findFirst().map(GlobalExceptionHandler::sentence)
                .orElse("Invalid request.");
        return ResponseEntity.badRequest().body(body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message, req,
                Map.of("fields", fields)));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class,
            HandlerMethodValidationException.class, MissingRequestCookieException.class})
    ResponseEntity<ErrorResponse> unreadable(Exception e, HttpServletRequest req) {
        return ResponseEntity.badRequest().body(body(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
                "The request is not valid.", req, null));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ErrorResponse> tooLarge(MaxUploadSizeExceededException e, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(body(HttpStatus.PAYLOAD_TOO_LARGE,
                "PAYLOAD_TOO_LARGE", "The file is too large.", req, null));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ErrorResponse> mediaType(HttpMediaTypeNotSupportedException e, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(body(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "UNSUPPORTED_MEDIA_TYPE", "This content type is not supported.", req, null));
    }

    @ExceptionHandler({NoResourceFoundException.class, HttpRequestMethodNotSupportedException.class})
    ResponseEntity<ErrorResponse> notFound(Exception e, HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body(HttpStatus.NOT_FOUND, "NOT_FOUND",
                "Not found.", req, null));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErrorResponse> unexpected(Exception e, HttpServletRequest req) {
        String correlationId = UUID.randomUUID().toString();
        log.error("Unexpected error [{}] on {} {}", correlationId, req.getMethod(), req.getRequestURI(), e);
        return ResponseEntity.internalServerError().body(body(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
                "Something went wrong. Please try again.", req, Map.of("correlationId", correlationId)));
    }

    public static ErrorResponse body(HttpStatus status, String code, String message, HttpServletRequest req,
                                     Map<String, Object> details) {
        return new ErrorResponse(Instant.now(), status.value(), code, message, req.getRequestURI(), details);
    }

    private static String sentence(String s) {
        if (s == null || s.isEmpty()) return "Invalid request.";
        String first = Character.toUpperCase(s.charAt(0)) + s.substring(1);
        return first.endsWith(".") ? first : first + ".";
    }
}
