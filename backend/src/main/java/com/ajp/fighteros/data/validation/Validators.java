package com.ajp.fighteros.data.validation;

import com.ajp.fighteros.data.CollectionName;
import java.util.Set;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Validation rules per collection. They mirror the frontend's TypeScript domain model
 * (frontend/src/types/domain.ts) and its form validations.
 */
@Configuration
public class Validators {

    static final Set<String> SESSION_TYPES = Set.of("bjj_gi", "bjj_nogi", "gym", "cardio_z2", "hiit", "mobility", "recovery", "rest");
    static final Set<String> INTENSITY = Set.of("low", "moderate", "high");
    static final Set<String> STATUS = Set.of("planned", "in_progress", "completed", "skipped");
    static final Set<String> MODALITY = Set.of("gi", "nogi");
    static final Set<String> RESULT = Set.of("win", "loss", "draw");
    static final Set<String> MOBILITY = Set.of("normal", "limited", "very_limited");
    static final Set<String> TECH_CATEGORY = Set.of("takedowns", "guard", "passes", "sweeps", "side_control", "mount", "back", "submissions", "escapes", "defense");
    static final Set<String> TECH_STATUS = Set.of("to_learn", "developing", "mastered");
    static final Set<String> GOAL_METRIC = Set.of("sessions", "bjj_hours", "gym_sessions", "cardio_minutes", "checkins");

    private static EntityValidator of(CollectionName name, java.util.function.BiConsumer<String, FieldChecker> rules) {
        return new EntityValidator() {
            public CollectionName collection() { return name; }
            public void validate(String entityId, FieldChecker c) { rules.accept(entityId, c); }
        };
    }

    @Bean
    EntityValidator profileValidator() {
        return of(CollectionName.PROFILE, (id, c) -> c
                .string("name", 1, 60, true)
                .oneOf("belt", Set.of("white", "blue", "purple", "brown", "black"), true)
                .number("currentWeightKg", 30, 200, true)
                .number("targetWeightKg", 30, 200, true)
                .oneOf("weightGoal", Set.of("maintain", "lose", "gain"), true)
                .integer("bjjDaysPerWeek", 0, 7, true)
                .integer("gymDaysPerWeek", 0, 7, true)
                .date("prepStartDate", true)
                .object("competition", true, comp -> comp.string("name", 1, 80, true).date("date", true).bool("dateConfirmed", true).string("weightCategory", 0, 80, false))
                .object("shoulder", true, s -> s
                        .oneOf("clearance", Set.of("pending", "limited", "full"), true)
                        .bool("loadsAuthorized", true)
                        .bool("intenseSparringAuthorized", true)
                        .date("lastReviewDate", false)
                        .string("notes", 0, 2000, false))
                .object("settings", true, s -> s.oneOf("weightUnit", Set.of("kg", "lb"), true).oneOf("theme", Set.of("dark", "light"), true))
                .object("rules", false, r -> r.number("matchDurationMin", 0.5, 30, false).number("weightLimitKg", 20, 500, false))
                .objectList("phases", 12, false, p -> p.string("name", 1, 80, true).date("start", true).date("end", true))
                .objectList("checklist", 200, false, i -> i.string("text", 1, 200, true).bool("done", true))
                .object("rehab", false, r -> r
                        .integer("s1", 0, 50, true)
                        .integer("s2", 0, 50, true)
                        .oneOf("variant", Set.of("anterior", "posterior"), false)
                        .integer("sessionsPerDay", 1, 4, true)));
    }

    @Bean
    EntityValidator sessionValidator() {
        return of(CollectionName.SESSIONS, (id, c) -> c
                .date("date", true)
                .time("time", true)
                .number("durationMin", 0, 600, true)
                .oneOf("type", SESSION_TYPES, true)
                .oneOf("intensity", INTENSITY, true)
                .oneOf("status", STATUS, true)
                .string("objective", 0, 200, false)
                .string("description", 0, 2000, false)
                .string("notes", 0, 4000, false)
                .stringList("activities", 50, 200, false)
                .bool("unplanned", true)
                .oneOf("skipReason", Set.of("cant_attend", "class_cancelled", "injury", "other"), false)
                .object("result", false, r -> r.number("durationMin", 1, 600, true).integer("rpe", 1, 10, true).string("notes", 0, 4000, false))
                .object("bjj", false, b -> b
                        .oneOf("modality", MODALITY, true)
                        .number("rounds", 0, 50, true)
                        .number("roundDurationMin", 0, 60, true)
                        .number("partners", 0, 50, true)
                        .integer("technicalQuality", 1, 10, false)
                        .integer("finalFatigue", 1, 10, false)
                        .objectList("sparring", 50, true, r -> r
                                .number("durationMin", 0.5, 60, true)
                                .oneOf("result", RESULT, false)
                                .integer("submissionsAttempted", 0, 99, true)
                                .integer("submissionsReceived", 0, 99, true)
                                .integer("guardPasses", 0, 99, true)
                                .integer("sweeps", 0, 99, true)
                                .integer("takedowns", 0, 99, true)))
                .object("gym", false, g -> g.objectList("exercises", 40, true, e -> e
                        .string("exerciseId", 1, 64, true)
                        .string("name", 1, 80, true)
                        .objectList("sets", 30, true, s -> s.number("reps", 0, 200, true).number("weightKg", 0, 500, true).number("rir", 0, 10, false))))
                .object("cardio", false, k -> k
                        .oneOf("kind", Set.of("z2", "hiit", "bjj_specific"), true)
                        .number("avgHr", 40, 230, false)
                        .number("maxHr", 40, 240, false)
                        .number("distanceKm", 0, 300, false)
                        .number("speedKmh", 0, 80, false)));
    }

    @Bean
    EntityValidator dailyLogValidator() {
        return of(CollectionName.DAILY_LOGS, (id, c) -> c
                .date("date", true)
                .number("weightKg", 30, 200, false)
                .number("sleepHours", 0, 16, false)
                .integer("sleepQuality", 1, 10, false)
                .integer("fatigue", 1, 10, false)
                .integer("stress", 1, 10, false)
                .integer("soreness", 1, 10, false)
                .integer("wellbeing", 1, 10, false)
                .number("restingHr", 25, 140, false)
                .integer("shoulderPain", 0, 10, false)
                .oneOf("shoulderMobility", MOBILITY, false)
                .bool("nightOut", false)
                .integer("drinks", 0, 50, false)
                .string("notes", 0, 2000, false));
    }

    @Bean
    EntityValidator exerciseValidator() {
        return of(CollectionName.EXERCISES, (id, c) -> c.string("name", 1, 60, true).string("muscleGroup", 1, 40, true).bool("upperBody", true));
    }

    @Bean
    EntityValidator routineValidator() {
        return of(CollectionName.ROUTINES, (id, c) -> c
                .string("name", 1, 60, true)
                .objectList("items", 40, true, i -> i.string("exerciseId", 1, 64, true).integer("sets", 1, 20, true).integer("reps", 1, 100, true)));
    }

    @Bean
    EntityValidator techniqueValidator() {
        return of(CollectionName.TECHNIQUES, (id, c) -> c
                .string("name", 1, 80, true)
                .oneOf("category", TECH_CATEGORY, true)
                .oneOf("status", TECH_STATUS, true)
                .bool("competitionMain", true)
                .oneOf("modality", Set.of("gi", "nogi", "both"), true)
                .string("notes", 0, 4000, false)
                .stringList("videoUrls", 20, 500, true));
    }

    @Bean
    EntityValidator nutritionValidator() {
        return of(CollectionName.NUTRITION, (id, c) -> c
                .date("date", true)
                .number("calories", 0, 10000, false)
                .number("proteinG", 0, 600, false)
                .number("carbsG", 0, 1500, false)
                .number("fatG", 0, 600, false)
                .number("waterL", 0, 15, false));
    }

    @Bean
    EntityValidator supplementValidator() {
        return of(CollectionName.SUPPLEMENTS, (id, c) -> c
                .string("name", 1, 60, true)
                .number("dose", 0, 100000, true)
                .string("unit", 1, 15, true)
                .stringList("times", 12, 5, false)
                .bool("active", true));
    }

    @Bean
    EntityValidator intakeValidator() {
        return of(CollectionName.SUPPLEMENT_INTAKES, (id, c) -> c.string("supplementId", 1, 64, true).date("date", true).string("time", 1, 5, true).number("dose", 0, 100000, true));
    }

    @Bean
    EntityValidator goalValidator() {
        return of(CollectionName.GOALS, (id, c) -> c.date("week", true).string("text", 1, 120, true).oneOf("metric", GOAL_METRIC, false).number("target", 1, 10000, false).bool("done", true));
    }

    @Bean
    EntityValidator simulationValidator() {
        return of(CollectionName.SIMULATIONS, (id, c) -> c
                .date("date", true)
                .oneOf("modality", MODALITY, true)
                .objectList("rounds", 20, true, r -> r
                        .number("durationMin", 0.5, 30, true)
                        .number("restMin", 0, 30, true)
                        .oneOf("result", RESULT, false)
                        .integer("rpe", 1, 10, false)
                        .integer("fatigue", 1, 10, false)));
    }

    /** Physio-prescribed shoulder rehab sessions (Derby programme): one exercise per section. */
    @Bean
    EntityValidator rehabLogValidator() {
        return of(CollectionName.REHAB_LOGS, (id, c) -> c
                .date("date", true)
                .string("program", 1, 40, true)
                .object("s1", false, s -> s.integer("index", 0, 50, true).integer("reps", 0, 1000, true))
                .object("s2", false, s -> s.integer("index", 0, 50, true).objectList("holds", 10, true, h -> h.number("seconds", 0, 600, true)))
                .string("notes", 0, 2000, false));
    }
}
