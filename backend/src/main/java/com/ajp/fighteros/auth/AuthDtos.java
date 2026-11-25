package com.ajp.fighteros.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Request/response DTOs of the authentication API. */
public final class AuthDtos {

    private AuthDtos() {}

    public record RegisterRequest(
            @NotBlank(message = "Indica tu nombre") @Size(max = 60, message = "Máximo 60 caracteres") String name,
            @NotBlank(message = "El email es obligatorio") @Email(message = "Email no válido") @Size(max = 254) String email,
            @NotBlank(message = "La contraseña es obligatoria")
            @Size(min = 8, max = 100, message = "Entre 8 y 100 caracteres")
            @Pattern(regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$", message = "Debe incluir letras y números")
            String password) {}

    public record LoginRequest(
            @NotBlank(message = "El email es obligatorio") @Email(message = "Email no válido") String email,
            @NotBlank(message = "La contraseña es obligatoria") @Size(max = 100) String password) {}

    public record UserDto(String id, String email, String name) {
        static UserDto from(User u) {
            return new UserDto(u.getId(), u.getEmail(), u.getName());
        }
    }

    public record AuthResponse(String token, UserDto user) {}
}
