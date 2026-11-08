package com.learnai.voice;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class VoiceTokensTest {

    @Test
    void tokensAreSingleUse() {
        VoiceTokens tokens = new VoiceTokens();
        UUID user = UUID.randomUUID();
        VoiceTokens.Issued a = tokens.issue(user);
        assertNotEquals(a.token(), tokens.issue(user).token());
        assertEquals(43, a.token().length()); // 32 random bytes, base64url without padding
        assertEquals(user, tokens.consume(a.token()));
        assertNull(tokens.consume(a.token()));
        assertNull(tokens.consume("nope"));
        assertNull(tokens.consume(null));
    }
}
