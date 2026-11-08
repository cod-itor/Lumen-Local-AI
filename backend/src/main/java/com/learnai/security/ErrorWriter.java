package com.learnai.security;

import com.learnai.exception.GlobalExceptionHandler;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** Writes the API_CONTRACT §3 error body from filters (outside Spring MVC). */
@Component
@RequiredArgsConstructor
public class ErrorWriter {

    private final ObjectMapper objectMapper;

    public void write(HttpServletRequest req, HttpServletResponse res, HttpStatus status, String code,
                      String message) throws IOException {
        res.setStatus(status.value());
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(res.getOutputStream(), GlobalExceptionHandler.body(status, code, message, req, null));
    }
}
