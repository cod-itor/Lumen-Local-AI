package com.learnai.service;

import java.util.UUID;

public interface UserService {

    /** Deletes the account, all its rows (FK cascade) and its stored files. */
    void deleteAccount(UUID userId, String password);
}
