package com.learnai.service.impl;

import com.learnai.config.AppProperties;
import com.learnai.entity.User;
import com.learnai.exception.ApiException;
import com.learnai.repository.UserRepository;
import com.learnai.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.FileSystemUtils;

import java.io.IOException;
import java.nio.file.Path;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AppProperties props;

    @Override
    @Transactional
    public void deleteAccount(UUID userId, String password) {
        User user = users.findById(userId).orElseThrow(ApiException::unauthenticated);
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Incorrect password.");
        }
        users.delete(user); // every user-owned table cascades on users.id
        try {
            FileSystemUtils.deleteRecursively(Path.of(props.storageDir(), "users", userId.toString()));
        } catch (IOException e) {
            log.warn("Could not delete stored files of user {}", userId, e);
        }
    }
}
