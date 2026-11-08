package com.learnai.dto.request;

import jakarta.validation.constraints.Size;

public record UpdateProviderRequest(@Size(min = 1, max = 60) String name, @Size(max = 500) String baseUrl,
                                    @Size(min = 1, max = 100) String model, @Size(max = 500) String apiKey) {}
