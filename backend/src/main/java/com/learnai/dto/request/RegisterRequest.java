package com.learnai.dto.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank(message = "name is required") @Size(max = 60, message = "name must be at most 60 characters") String name,
        @NotBlank(message = "email is required") @Email(message = "email is not valid")
        @Size(max = 254, message = "email is too long") String email,
        @NotBlank(message = "password is required")
        @Size(min = 8, max = 72, message = "password must be 8-72 characters")
        @Pattern(regexp = "^(?=.*\\p{L})(?=.*\\d).*$", message = "password needs at least one letter and one digit")
        String password) {
}
