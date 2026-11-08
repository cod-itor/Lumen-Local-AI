package com.learnai.controller;

import com.learnai.dto.request.DeleteAccountRequest;
import com.learnai.security.CookieService;
import com.learnai.security.CurrentUser;
import com.learnai.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Users")
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final CookieService cookies;

    @Operation(summary = "Delete my account and all my data")
    @DeleteMapping("/me")
    public ResponseEntity<Void> deleteMe(@AuthenticationPrincipal CurrentUser user,
                                         @Valid @RequestBody DeleteAccountRequest body, HttpServletResponse res) {
        userService.deleteAccount(user.id(), body.password());
        cookies.clearSession(res);
        return ResponseEntity.noContent().build();
    }
}
