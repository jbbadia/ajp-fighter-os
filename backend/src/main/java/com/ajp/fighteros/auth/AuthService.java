package com.ajp.fighteros.auth;

import com.ajp.fighteros.auth.AuthDtos.AuthResponse;
import com.ajp.fighteros.auth.AuthDtos.LoginRequest;
import com.ajp.fighteros.auth.AuthDtos.RegisterRequest;
import com.ajp.fighteros.auth.AuthDtos.UserDto;
import com.ajp.fighteros.common.ApiException;
import java.util.Locale;
import java.util.Map;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    /** Hash checked when the email does not exist, so response time does not reveal registered emails. */
    private final String dummyHash;

    private final UserRepository users;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final LoginAttemptService attempts;

    public AuthService(UserRepository users, PasswordEncoder encoder, JwtService jwt, LoginAttemptService attempts) {
        this.users = users;
        this.encoder = encoder;
        this.jwt = jwt;
        this.attempts = attempts;
        this.dummyHash = encoder.encode("dummy-password-for-timing");
    }

    public AuthResponse register(RegisterRequest req) {
        String email = normalize(req.email());
        if (users.existsByEmail(email)) {
            throw ApiException.conflict("Ya existe una cuenta con ese email", Map.of("email", "Ya existe una cuenta con ese email"));
        }
        try {
            User user = users.save(new User(email, req.name().trim(), encoder.encode(req.password())));
            return new AuthResponse(jwt.issue(user), UserDto.from(user));
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("Ya existe una cuenta con ese email", Map.of("email", "Ya existe una cuenta con ese email"));
        }
    }

    public AuthResponse login(LoginRequest req) {
        String email = normalize(req.email());
        if (attempts.isLocked(email)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos.");
        }
        User user = users.findByEmail(email).orElse(null);
        boolean ok = encoder.matches(req.password(), user != null ? user.getPasswordHash() : dummyHash);
        if (user == null || !ok) {
            attempts.failed(email);
            throw new BadCredentialsException("bad credentials");
        }
        attempts.succeeded(email);
        return new AuthResponse(jwt.issue(user), UserDto.from(user));
    }

    public UserDto me(AuthUser principal) {
        return users.findById(principal.id()).map(UserDto::from)
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Sesión no válida"));
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }
}
