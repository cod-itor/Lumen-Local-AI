package com.learnai.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/** API_CONTRACT §4.8 / §6.7 request bodies. */
public final class ImageRequests {

    private ImageRequests() {}

    public record CreateSession(@Size(max = 80) String title) {}

    public record RenameSession(@NotBlank @Size(max = 80) String title) {}

    public record Generate(@NotNull UUID sessionId, @NotBlank @Size(max = 1000) String prompt,
                           @Size(max = 1000) String originalPrompt,
                           @NotNull @Pattern(regexp = "SQUARE|PORTRAIT|LANDSCAPE|WIDE") String aspectRatio,
                           @NotNull @Min(1) @Max(4) Integer count, Long seed, Integer steps) {}

    public record Variations(@NotNull @Min(1) @Max(4) Integer count) {}
}
