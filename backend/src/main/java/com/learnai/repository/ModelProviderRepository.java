package com.learnai.repository;

import com.learnai.entity.ModelProvider;
import com.learnai.entity.enums.ProviderKind;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ModelProviderRepository extends JpaRepository<ModelProvider, UUID> {

    List<ModelProvider> findByUserIdOrderByCreatedAtAsc(UUID userId);

    Optional<ModelProvider> findByIdAndUserId(UUID id, UUID userId);

    Optional<ModelProvider> findByUserIdAndKind(UUID userId, ProviderKind kind);

    Optional<ModelProvider> findByUserIdAndDefaultProviderTrue(UUID userId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update ModelProvider p set p.defaultProvider = false where p.userId = :userId and p.defaultProvider = true")
    int clearDefault(UUID userId);
}
