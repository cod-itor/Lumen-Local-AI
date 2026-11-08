package com.learnai.dto.response;

import com.learnai.entity.enums.Role;

import java.time.Instant;
import java.util.UUID;

public record UserDto(UUID id, String name, String email, Role role, Instant createdAt) {
}
