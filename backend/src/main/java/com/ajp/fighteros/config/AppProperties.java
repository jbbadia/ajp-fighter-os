package com.ajp.fighteros.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Typed view of the {@code app.*} configuration, populated from environment variables. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(Jwt jwt, Cors cors, Limits limits) {

    public record Jwt(String secret, Duration expiration) {}

    public record Cors(List<String> allowedOrigins) {}

    public record Limits(int maxEntitiesPerCollection, int maxEntityBytes) {}
}
