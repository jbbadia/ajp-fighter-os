package com.ajp.fighteros.data;

import com.ajp.fighteros.auth.AuthUser;
import com.ajp.fighteros.common.ApiException;
import java.time.Instant;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Full export / restore of the user's data in the same format as the frontend backup file. */
@RestController
@RequestMapping("/api/backup")
public class BackupController {

    static final String APP = "ajp-fighter-os";
    static final int VERSION = 1;

    private final EntityService service;

    public BackupController(EntityService service) {
        this.service = service;
    }

    public record Backup(String app, Integer version, Instant exportedAt, Map<String, List<Map<String, Object>>> collections) {}

    @GetMapping
    public Backup export(@AuthenticationPrincipal AuthUser user) {
        Map<String, List<Map<String, Object>>> cols = new LinkedHashMap<>();
        service.exportAll(user.id()).forEach((c, items) -> cols.put(c.path(), items));
        return new Backup(APP, VERSION, Instant.now(), cols);
    }

    @PutMapping
    public ResponseEntity<Void> restore(@AuthenticationPrincipal AuthUser user, @RequestBody Backup backup) {
        if (!APP.equals(backup.app()) || backup.collections() == null) {
            throw ApiException.badRequest("El archivo no es una copia de seguridad de AJP Fighter OS", Map.of());
        }
        if (backup.version() == null || backup.version() > VERSION) {
            throw ApiException.badRequest("Versión de copia no soportada", Map.of());
        }
        Map<CollectionName, List<Map<String, Object>>> data = new EnumMap<>(CollectionName.class);
        backup.collections().forEach((name, items) -> data.put(CollectionName.fromPath(name), items == null ? List.of() : items));
        if (data.getOrDefault(CollectionName.PROFILE, List.of()).stream().noneMatch(p -> EntityService.PROFILE_ID.equals(p.get("id")))) {
            throw ApiException.badRequest("La copia no contiene el perfil del deportista", Map.of());
        }
        service.replaceAll(user.id(), data);
        return ResponseEntity.noContent().build();
    }
}
