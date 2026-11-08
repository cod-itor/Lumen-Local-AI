package com.learnai.dto.response;

import org.springframework.data.domain.Page;

import java.util.List;
import java.util.function.Function;

public record PageResponse<T>(List<T> items, int page, int size, long totalItems, int totalPages) {
    public static <E, T> PageResponse<T> of(Page<E> p, Function<E, T> map) {
        return new PageResponse<>(p.getContent().stream().map(map).toList(), p.getNumber(), p.getSize(),
                p.getTotalElements(), p.getTotalPages());
    }
}
