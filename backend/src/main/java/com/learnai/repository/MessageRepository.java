package com.learnai.repository;

import com.learnai.entity.Message;
import com.learnai.entity.enums.MessageRole;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    List<Message> findByChatIdOrderByCreatedAtAsc(UUID chatId, Limit limit);

    Optional<Message> findByIdAndChatId(UUID id, UUID chatId);

    boolean existsByParentIdAndRole(UUID parentId, MessageRole role);

    long countByChatId(UUID chatId);
}
