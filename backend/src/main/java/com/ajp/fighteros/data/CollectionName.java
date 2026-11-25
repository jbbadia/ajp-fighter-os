package com.ajp.fighteros.data;

import com.ajp.fighteros.common.ApiException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

/** Whitelist of collections the client can read and write. Path names match the frontend. */
public enum CollectionName {
    PROFILE("profile"),
    SESSIONS("sessions"),
    DAILY_LOGS("dailyLogs"),
    EXERCISES("exercises"),
    ROUTINES("routines"),
    TECHNIQUES("techniques"),
    NUTRITION("nutrition"),
    SUPPLEMENTS("supplements"),
    SUPPLEMENT_INTAKES("supplementIntakes"),
    GOALS("goals"),
    SIMULATIONS("simulations");

    private final String path;

    CollectionName(String path) {
        this.path = path;
    }

    public String path() {
        return path;
    }

    public static CollectionName fromPath(String path) {
        return Arrays.stream(values())
                .filter(c -> c.path.equals(path))
                .findFirst()
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Colección desconocida: " + path));
    }
}
