package com.ajp.fighteros.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Simple brute-force protection: after {@value #MAX_FAILURES} failed logins for the same
 * email, further attempts are rejected for {@link #LOCK} (in-memory, per instance).
 */
@Service
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(15);

    private record Attempts(int failures, Instant lastFailure) {}

    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public boolean isLocked(String email) {
        Attempts a = attempts.get(email);
        if (a == null) return false;
        if (a.lastFailure().plus(LOCK).isBefore(clock.instant())) {
            attempts.remove(email);
            return false;
        }
        return a.failures() >= MAX_FAILURES;
    }

    public void failed(String email) {
        attempts.merge(email, new Attempts(1, clock.instant()), (old, n) -> new Attempts(old.failures() + 1, clock.instant()));
    }

    public void succeeded(String email) {
        attempts.remove(email);
    }
}
