package com.learnai.entity.enums;

/** Which side generates for a provider kind (API_CONTRACT §4.5). */
public final class ProviderKindSide {
    private ProviderKindSide() {}

    public static GenerationSide of(ProviderKind kind) {
        return kind == ProviderKind.HOST || kind == ProviderKind.REMOTE_URL ? GenerationSide.SERVER : GenerationSide.CLIENT;
    }
}
