package com.ajp.fighteros.auth;

/** Authenticated principal placed in the security context by {@link JwtAuthFilter}. */
public record AuthUser(String id, String email) {}
