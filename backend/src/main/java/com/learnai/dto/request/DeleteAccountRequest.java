package com.learnai.dto.request;

import jakarta.validation.constraints.NotBlank;

public record DeleteAccountRequest(@NotBlank(message = "password is required") String password) {
}
