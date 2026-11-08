package com.learnai.repository;

import com.learnai.entity.Chat;
import com.learnai.entity.enums.Tab;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.UUID;

public interface ChatRepository extends JpaRepository<Chat, UUID> {

    Page<Chat> findByUserIdAndTabOrderByUpdatedAtDesc(UUID userId, Tab tab, Pageable pageable);

    Page<Chat> findByUserIdAndTabAndTitleContainingIgnoreCaseOrderByUpdatedAtDesc(UUID userId, Tab tab, String q,
                                                                                  Pageable pageable);

    Optional<Chat> findByIdAndUserId(UUID id, UUID userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Chat c where c.id = :id")
    Optional<Chat> findForUpdate(UUID id);
}
