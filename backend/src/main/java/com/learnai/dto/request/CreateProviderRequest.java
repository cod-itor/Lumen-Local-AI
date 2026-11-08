package com.learnai.dto.request;

import com.learnai.entity.enums.ProviderKind;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateProviderRequest(@NotBlank @Size(max = 60) String name, @NotNull ProviderKind kind,
                                    @Size(max = 500) String baseUrl, @NotBlank @Size(max = 100) String model,
                                    @Size(max = 500) String apiKey, Boolean makeDefault) {}
