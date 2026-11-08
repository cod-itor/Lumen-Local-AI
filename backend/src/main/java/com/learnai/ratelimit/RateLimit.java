package com.learnai.ratelimit;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Rate-limit a controller method with the named bucket(s) (API_CONTRACT §3.3). Buckets whose name ends in
 * {@code .ip} are keyed by client IP, all others by the authenticated user id.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {
    String[] value();
}
