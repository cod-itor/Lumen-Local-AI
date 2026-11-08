package com.learnai.repository;

import com.learnai.entity.LearningStep;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface LearningStepRepository extends JpaRepository<LearningStep, UUID> {

    List<LearningStep> findByPathIdOrderByPosition(UUID pathId);

    /** Quizzes and attempts go with the steps (ON DELETE CASCADE). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "DELETE FROM learning_steps WHERE path_id = :pathId", nativeQuery = true)
    int deleteByPathId(UUID pathId);
}
