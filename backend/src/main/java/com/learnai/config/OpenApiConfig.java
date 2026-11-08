package com.learnai.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Swagger UI at /swagger-ui.html; "Authorize" with the accessToken from /api/auth/login. */
@Configuration
public class OpenApiConfig {

    @Bean
    OpenAPI lumenOpenApi() {
        return new OpenAPI()
                .info(new Info().title("Lumen API").version("v1")
                        .description("Local AI learning assistant — see docs/API_CONTRACT.md"))
                .components(new Components().addSecuritySchemes("bearerAuth",
                        new SecurityScheme().type(SecurityScheme.Type.HTTP).scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList("bearerAuth"));
    }
}
