package com.learnai.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Result of the browser-side connection test (FRONTEND.md §8.2). */
public record ProviderTestResultRequest(@NotNull Boolean ok, @NotNull @Size(max = 20) List<@Valid Check> checks,
                                        @Valid ModelInfo modelInfo) {

    public record Check(@NotNull @Size(max = 40) String name, boolean ok, @Size(max = 500) String message) {}

    public record ModelInfo(@Size(max = 100) String name, @Size(max = 60) String family,
                            @Size(max = 30) String parameterSize, @Size(max = 30) String quantization,
                            Integer contextLength) {}
}
