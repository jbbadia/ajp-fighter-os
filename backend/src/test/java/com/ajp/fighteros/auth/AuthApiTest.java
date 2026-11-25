package com.ajp.fighteros.auth;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ajp.fighteros.ApiTestSupport;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthApiTest extends ApiTestSupport {

    private static final Map<String, String> VALID = Map.of("name", "Juan", "email", "Juan@Example.com", "password", "Segura123");

    @Test
    void registersLogsInAndReturnsCurrentUser() throws Exception {
        String body = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(toJson(VALID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token", notNullValue()))
                .andExpect(jsonPath("$.user.email").value("juan@example.com"))
                .andReturn().getResponse().getContentAsString();
        String token = json.readTree(body).get("token").asText();

        mvc.perform(get("/api/auth/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Juan"))
                .andExpect(content().string(not(containsString("password"))));

        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "juan@example.com", "password", "Segura123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", notNullValue()));
    }

    @Test
    void storesPasswordHashedNeverInPlainText() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(toJson(VALID))).andExpect(status().isCreated());
        User u = users.findByEmail("juan@example.com").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(u.getPasswordHash()).startsWith("$2").doesNotContain("Segura123");
    }

    @Test
    void rejectsDuplicateEmail() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(toJson(VALID))).andExpect(status().isCreated());
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(toJson(VALID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.fieldErrors.email").exists());
    }

    @Test
    void validatesRegistrationFields() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("name", "", "email", "no-es-email", "password", "corta"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void rejectsWrongPasswordAndLocksAfterRepeatedFailures() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content(toJson(Map.of("name", "Bloqueo", "email", "bloqueo@example.com", "password", "Segura123")))).andExpect(status().isCreated());
        String wrong = toJson(Map.of("email", "bloqueo@example.com", "password", "Incorrecta1"));
        for (int i = 0; i < 5; i++) {
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(wrong)).andExpect(status().isUnauthorized());
        }
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("email", "bloqueo@example.com", "password", "Segura123"))))
                .andExpect(status().isTooManyRequests());
    }

    @Test
    void protectedEndpointsRequireAValidToken() throws Exception {
        mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.message").exists());
        mvc.perform(get("/api/collections/sessions").header("Authorization", "Bearer token-falso")).andExpect(status().isUnauthorized());
    }
}
