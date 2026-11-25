package com.ajp.fighteros.data;

import com.ajp.fighteros.auth.AuthUser;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST resource for the athlete's data, one collection at a time:
 * <pre>
 *   GET    /api/collections/{collection}
 *   PUT    /api/collections/{collection}/{id}   (create or replace)
 *   DELETE /api/collections/{collection}/{id}
 * </pre>
 * Every operation is scoped to the authenticated user.
 */
@RestController
@RequestMapping("/api/collections/{collection}")
public class EntityController {

    private final EntityService service;

    public EntityController(EntityService service) {
        this.service = service;
    }

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal AuthUser user, @PathVariable String collection) {
        return service.list(user.id(), CollectionName.fromPath(collection));
    }

    @PutMapping("/{id}")
    public Map<String, Object> upsert(
            @AuthenticationPrincipal AuthUser user,
            @PathVariable String collection,
            @PathVariable String id,
            @RequestBody Map<String, Object> body) {
        return service.upsert(user.id(), CollectionName.fromPath(collection), id, body);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AuthUser user, @PathVariable String collection, @PathVariable String id) {
        service.delete(user.id(), CollectionName.fromPath(collection), id);
        return ResponseEntity.noContent().build();
    }
}
