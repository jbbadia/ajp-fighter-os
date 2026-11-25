package com.ajp.fighteros;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.ajp.fighteros.auth.UserRepository;
import com.ajp.fighteros.data.EntityRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Spring context with embedded MongoDB (flapdoodle) and helpers shared by the API tests. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
public abstract class ApiTestSupport {

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper json;
    @Autowired protected UserRepository users;
    @Autowired protected EntityRepository entities;

    @BeforeEach
    void cleanDatabase() {
        entities.deleteAll();
        users.deleteAll();
    }

    protected String toJson(Object o) throws Exception {
        return json.writeValueAsString(o);
    }

    /** Registers a fresh user and returns its bearer token. */
    protected String registerAndGetToken() throws Exception {
        String email = "atleta-" + UUID.randomUUID() + "@example.com";
        String body = mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(toJson(Map.of("name", "Atleta", "email", email, "password", "Segura123"))))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        JsonNode node = json.readTree(body);
        return node.get("token").asText();
    }

    protected static String bearer(String token) {
        return "Bearer " + token;
    }
}
