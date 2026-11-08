package com.learnai.client;

import tools.jackson.databind.JsonNode;

/** One internal SSE event from the AI service (AI_SERVICE.md §4.2–4.3). */
public record AiEvent(String name, JsonNode data) {}
