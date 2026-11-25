package com.ajp.fighteros.data;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ajp.fighteros.ApiTestSupport;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

public class BackupApiTest extends ApiTestSupport {

    public static Map<String, Object> profile() {
        Map<String, Object> p = new HashMap<>();
        p.put("id", "me");
        p.put("name", "Juan");
        p.put("belt", "white");
        p.put("currentWeightKg", 77.5);
        p.put("targetWeightKg", 77.5);
        p.put("weightGoal", "maintain");
        p.put("bjjDaysPerWeek", 6);
        p.put("gymDaysPerWeek", 4);
        p.put("prepStartDate", "2026-11-25");
        p.put("competition", Map.of("name", "AJP 2027", "date", "2027-02-01", "dateConfirmed", false, "weightCategory", ""));
        p.put("shoulder", Map.of("clearance", "pending", "loadsAuthorized", false, "intenseSparringAuthorized", false, "notes", ""));
        p.put("settings", Map.of("weightUnit", "kg", "theme", "dark"));
        return p;
    }

    @Test
    void exportsAndRestoresAllCollections() throws Exception {
        String token = registerAndGetToken();
        mvc.perform(put("/api/collections/sessions/old").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(EntityApiTest.session("old")))).andExpect(status().isOk());

        Map<String, Object> backup = Map.of(
                "app", "ajp-fighter-os",
                "version", 1,
                "collections", Map.of(
                        "profile", List.of(profile()),
                        "sessions", List.of(EntityApiTest.session("a"), EntityApiTest.session("b"))));

        mvc.perform(put("/api/backup").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(backup))).andExpect(status().isNoContent());

        mvc.perform(get("/api/backup").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.app").value("ajp-fighter-os"))
                .andExpect(jsonPath("$.collections.sessions", hasSize(2)))
                .andExpect(jsonPath("$.collections.profile[0].name").value("Juan"));
    }

    @Test
    void rejectsInvalidBackupWithoutTouchingExistingData() throws Exception {
        String token = registerAndGetToken();
        mvc.perform(put("/api/collections/sessions/keep").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(EntityApiTest.session("keep")))).andExpect(status().isOk());

        Map<String, Object> bad = EntityApiTest.session("bad");
        bad.put("durationMin", -5);
        Map<String, Object> backup = Map.of("app", "ajp-fighter-os", "version", 1,
                "collections", Map.of("profile", List.of(profile()), "sessions", List.of(bad)));

        mvc.perform(put("/api/backup").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(backup))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/collections/sessions").header("Authorization", bearer(token)))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value("keep"));

        mvc.perform(put("/api/backup").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("app", "otra-app", "version", 1, "collections", Map.of()))))
                .andExpect(status().isBadRequest());
    }
}
