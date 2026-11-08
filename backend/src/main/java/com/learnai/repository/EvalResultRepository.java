package com.learnai.repository;

import com.learnai.entity.EvalResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EvalResultRepository extends JpaRepository<EvalResult, UUID> {

    List<EvalResult> findByRunIdOrderByCreatedAtAsc(UUID runId);

    Optional<EvalResult> findByRunIdAndCaseId(UUID runId, String caseId);

    long countByRunId(UUID runId);

    long countByRunIdAndErrorIsNotNull(UUID runId);
}
