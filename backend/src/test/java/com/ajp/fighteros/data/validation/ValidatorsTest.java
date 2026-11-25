package com.ajp.fighteros.data.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Pure unit tests for the per-collection validation rules (no Spring context). */
class ValidatorsTest {

    private final Validators v = new Validators();

    @Test
    void dailyLogAcceptsNullOptionalFieldsAndRejectsOutOfRange() {
        Map<String, Object> ok = new HashMap<>();
        ok.put("date", "2026-11-25");
        ok.put("weightKg", null);
        ok.put("fatigue", 7);
        assertThat(v.dailyLogValidator().check("d1", ok)).isEmpty();

        Map<String, Object> bad = new HashMap<>(ok);
        bad.put("fatigue", 11);
        bad.put("shoulderPain", 3.5);
        bad.put("shoulderMobility", "rota");
        assertThat(v.dailyLogValidator().check("d1", bad)).containsKeys("fatigue", "shoulderPain", "shoulderMobility");
    }

    @Test
    void techniqueRequiresHttpLinks() {
        Map<String, Object> t = new HashMap<>(Map.of(
                "name", "Barrido de tijera", "category", "sweeps", "status", "developing",
                "competitionMain", true, "modality", "both", "videoUrls", List.of("https://example.com/v", "javascript:alert(1)")));
        assertThat(v.techniqueValidator().check("t1", t)).containsOnlyKeys("videoUrls.1");
    }

    @Test
    void supplementTimesMustBeHHmm() {
        Map<String, Object> s = new HashMap<>(Map.of("name", "Creatina", "dose", 5, "unit", "g", "times", List.of("08:00", "25:00"), "active", true));
        assertThat(v.supplementValidator().check("s1", s)).containsOnlyKeys("times.1");
    }

    @Test
    void nestedSparringRoundsAreValidated() {
        Map<String, Object> round = new HashMap<>(Map.of("durationMin", 6, "submissionsAttempted", 1, "submissionsReceived", 0,
                "guardPasses", 0, "sweeps", -1, "takedowns", 0));
        Map<String, Object> bjj = new HashMap<>(Map.of("modality", "gi", "rounds", 5, "roundDurationMin", 6, "partners", 4, "sparring", List.of(round)));
        Map<String, Object> s = new HashMap<>(Map.of("date", "2026-11-25", "time", "19:30", "durationMin", 90, "type", "bjj_gi",
                "intensity", "moderate", "status", "completed", "unplanned", false, "bjj", bjj));
        assertThat(v.sessionValidator().check("s1", s)).containsOnlyKeys("bjj.sparring.0.sweeps");
    }

    @Test
    void reportsMissingRequiredFields() {
        assertThat(v.exerciseValidator().check("e1", new HashMap<>())).containsKeys("name", "muscleGroup", "upperBody");
    }
}
