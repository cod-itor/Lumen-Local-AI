package com.learnai.repository;

import com.learnai.entity.QuizAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, UUID> {}
