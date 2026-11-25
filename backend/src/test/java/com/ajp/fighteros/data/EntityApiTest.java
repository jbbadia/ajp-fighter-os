package com.ajp.fighteros.data;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

class EntityApiTest extends ApiTestSupport {

    static Map<String, Object> session(String id) {
        Map<String, Object> s = new HashMap<>();
        s.put("id", id);
        s.put("createdAt", "2026-11-25T10:00:00Z");
        s.put("updatedAt", "2026-11-25T10:00:00Z");
        s.put("date", "2026-11-25");
        s.put("time", "19:30");
        s.put("durationMin", 90);
        s.put("type", "bjj_gi");
        s.put("intensity", "moderate");
        s.put("objective", "Técnica");
        s.put("description", "");
        s.put("activities", List.of("Calentamiento", "Drilling"));
        s.put("status", "completed");
        s.put("notes", "");
        s.put("unplanned", false);
        s.put("requiresClearance", null);
        s.put("startedAt", null);
        s.put("result", Map.of("durationMin", 85, "rpe", 7, "notes", "", "completedAt", "2026-11-25T21:00:00Z"));
        return s;
    }

    @Test
    void createsListsUpdatesAndDeletesEntities() throws Exception {
        String token = registerAndGetToken();
        Map<String, Object> s = session("s1");

        mvc.perform(put("/api/collections/sessions/s1").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(s)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.objective").value("Técnica"));

        s.put("objective", "Rounds");
        mvc.perform(put("/api/collections/sessions/s1").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(s))).andExpect(status().isOk());

        mvc.perform(get("/api/collections/sessions").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].objective").value("Rounds"))
                .andExpect(jsonPath("$[0].result.rpe").value(7));

        mvc.perform(delete("/api/collections/sessions/s1").header("Authorization", bearer(token))).andExpect(status().isNoContent());
        mvc.perform(get("/api/collections/sessions").header("Authorization", bearer(token))).andExpect(jsonPath("$", hasSize(0)));
        // idempotent delete
        mvc.perform(delete("/api/collections/sessions/s1").header("Authorization", bearer(token))).andExpect(status().isNoContent());
    }

    @Test
    void usersCannotSeeEachOthersData() throws Exception {
        String alice = registerAndGetToken();
        String bob = registerAndGetToken();
        mvc.perform(put("/api/collections/sessions/s1").header("Authorization", bearer(alice))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(session("s1")))).andExpect(status().isOk());

        mvc.perform(get("/api/collections/sessions").header("Authorization", bearer(bob))).andExpect(jsonPath("$", hasSize(0)));
        // Bob deleting the same id must not affect Alice
        mvc.perform(delete("/api/collections/sessions/s1").header("Authorization", bearer(bob))).andExpect(status().isNoContent());
        mvc.perform(get("/api/collections/sessions").header("Authorization", bearer(alice))).andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void rejectsInvalidEntitiesWithFieldErrors() throws Exception {
        String token = registerAndGetToken();
        Map<String, Object> s = session("s2");
        s.put("date", "25/11/2026");
        s.put("type", "boxeo");
        s.put("result", Map.of("durationMin", 60, "rpe", 15));

        mvc.perform(put("/api/collections/sessions/s2").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(s)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.date").exists())
                .andExpect(jsonPath("$.fieldErrors.type").exists())
                .andExpect(jsonPath("$.fieldErrors['result.rpe']").exists());
    }

    @Test
    void rejectsMismatchedIdsUnknownCollectionsAndOperatorKeys() throws Exception {
        String token = registerAndGetToken();
        mvc.perform(put("/api/collections/sessions/otro").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(session("s3")))).andExpect(status().isBadRequest());

        mvc.perform(get("/api/collections/usuarios").header("Authorization", bearer(token))).andExpect(status().isNotFound());

        Map<String, Object> evil = session("s4");
        evil.put("$where", "1");
        mvc.perform(put("/api/collections/sessions/s4").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(evil))).andExpect(status().isBadRequest());
    }

    @Test
    void profileMustUseTheFixedId() throws Exception {
        String token = registerAndGetToken();
        mvc.perform(put("/api/collections/profile/otro").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content(toJson(Map.of("id", "otro"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.id").exists());
    }

    @Test
    void enforcesPerCollectionQuota() throws Exception {
        String token = registerAndGetToken(); // test profile limit: 50 per collection
        for (int i = 0; i < 50; i++) {
            mvc.perform(put("/api/collections/sessions/q" + i).header("Authorization", bearer(token))
                    .contentType(MediaType.APPLICATION_JSON).content(toJson(session("q" + i)))).andExpect(status().isOk());
        }
        mvc.perform(put("/api/collections/sessions/q50").header("Authorization", bearer(token))
                .contentType(MediaType.APPLICATION_JSON).content(toJson(session("q50")))).andExpect(status().isUnprocessableEntity());
    }
}
