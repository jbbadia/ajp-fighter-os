package com.ajp.fighteros.auth;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;

class LoginAttemptServiceTest {

    @Test
    void locksAfterMaxFailuresAndUnlocksAfterTheLockPeriod() {
        AtomicReference<Instant> now = new AtomicReference<>(Instant.parse("2026-11-25T10:00:00Z"));
        Clock clock = new Clock() {
            public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId z) { return this; }
            public Instant instant() { return now.get(); }
        };
        LoginAttemptService s = new LoginAttemptService(clock);
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES - 1; i++) s.failed("a@b.c");
        assertThat(s.isLocked("a@b.c")).isFalse();
        s.failed("a@b.c");
        assertThat(s.isLocked("a@b.c")).isTrue();

        now.set(now.get().plus(LoginAttemptService.LOCK).plusSeconds(1));
        assertThat(s.isLocked("a@b.c")).isFalse();
    }

    @Test
    void successResetsTheCounter() {
        LoginAttemptService s = new LoginAttemptService();
        for (int i = 0; i < 4; i++) s.failed("x@y.z");
        s.succeeded("x@y.z");
        s.failed("x@y.z");
        assertThat(s.isLocked("x@y.z")).isFalse();
    }
}
