package com.learnai.repository;

import com.learnai.entity.GuardEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface GuardEventRepository extends JpaRepository<GuardEvent, UUID> {
}
