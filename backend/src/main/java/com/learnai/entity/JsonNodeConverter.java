package com.learnai.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * JSONB columns as Jackson trees. The JDBC URL uses {@code stringtype=unspecified}, so Postgres casts the
 * bound text to jsonb itself.
 */
@Converter
public class JsonNodeConverter implements AttributeConverter<JsonNode, String> {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @Override
    public String convertToDatabaseColumn(JsonNode value) {
        return value == null ? null : MAPPER.writeValueAsString(value);
    }

    @Override
    public JsonNode convertToEntityAttribute(String db) {
        return db == null ? null : MAPPER.readTree(db);
    }
}
