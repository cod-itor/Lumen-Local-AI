package com.learnai.harness.task;

import com.learnai.repository.ImageSessionRepository;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.ObjectMapper;

@Configuration
class ImageTaskHandlers {

    @Bean
    TaskHandler imageClarifyTaskHandler(ImageSessionRepository sessions, ObjectMapper json) {
        return new ImageTaskHandler.Clarify(sessions, json);
    }

    @Bean
    TaskHandler imagePromptTaskHandler(ImageSessionRepository sessions, ObjectMapper json) {
        return new ImageTaskHandler.Prompt(sessions, json);
    }
}
