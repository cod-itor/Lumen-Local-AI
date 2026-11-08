package com.learnai.security;

import com.learnai.entity.enums.Role;

import java.util.UUID;

/** Authenticated principal taken from the access token (no DB lookup per request). */
public record CurrentUser(UUID id, Role role) {
}
