package com.ajp.fighteros.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Business exception carrying an HTTP status and optional per-field errors. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final transient Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String message) {
        this(status, message, Map.of());
    }

    public ApiException(HttpStatus status, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.fieldErrors = fieldErrors;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }

    public static ApiException badRequest(String message, Map<String, String> fieldErrors) {
        return new ApiException(HttpStatus.BAD_REQUEST, message, fieldErrors);
    }

    public static ApiException notFound(String message) {
        return new ApiException(HttpStatus.NOT_FOUND, message);
    }

    public static ApiException conflict(String message, Map<String, String> fieldErrors) {
        return new ApiException(HttpStatus.CONFLICT, message, fieldErrors);
    }
}
