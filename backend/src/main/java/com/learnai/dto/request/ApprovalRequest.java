package com.learnai.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** API_CONTRACT §6.4: approve or edit the web search query of an AWAITING_APPROVAL turn. */
public record ApprovalRequest(@NotNull @Pattern(regexp = "APPROVE|EDIT") String decision,
                              @Size(max = 200) String content) {}
