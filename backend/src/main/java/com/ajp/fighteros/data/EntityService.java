package com.ajp.fighteros.data;

import com.ajp.fighteros.common.ApiException;
import com.ajp.fighteros.config.AppProperties;
import com.ajp.fighteros.data.validation.EntityValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Per-user CRUD over client entities, with validation and quotas. */
@Service
public class EntityService {

    private static final Pattern ID = Pattern.compile("^[A-Za-z0-9_-]{1,64}$");
    static final String PROFILE_ID = "me";

    private final EntityRepository repo;
    private final Map<CollectionName, EntityValidator> validators = new EnumMap<>(CollectionName.class);
    private final ObjectMapper mapper;
    private final AppProperties.Limits limits;

    public EntityService(EntityRepository repo, List<EntityValidator> validators, ObjectMapper mapper, AppProperties props) {
        this.repo = repo;
        this.mapper = mapper;
        this.limits = props.limits();
        validators.forEach(v -> this.validators.put(v.collection(), v));
    }

    public List<Map<String, Object>> list(String userId, CollectionName collection) {
        return repo.findByUserIdAndCollection(userId, collection).stream().map(EntityDocument::getData).toList();
    }

    public Map<String, Object> upsert(String userId, CollectionName collection, String entityId, Map<String, Object> body) {
        validate(collection, entityId, body);
        var existing = repo.findByUserIdAndCollectionAndEntityId(userId, collection, entityId);
        if (existing.isPresent()) {
            EntityDocument doc = existing.get();
            doc.replaceData(body);
            return repo.save(doc).getData();
        }
        if (repo.countByUserIdAndCollection(userId, collection) >= limits.maxEntitiesPerCollection()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Se ha alcanzado el máximo de registros en esta colección");
        }
        return repo.save(new EntityDocument(userId, collection, entityId, body)).getData();
    }

    /** Idempotent: deleting a missing entity is not an error. */
    public void delete(String userId, CollectionName collection, String entityId) {
        checkId(entityId);
        repo.deleteByUserIdAndCollectionAndEntityId(userId, collection, entityId);
    }

    /** Replaces every collection of the user (backup restore). Validates everything first. */
    public void replaceAll(String userId, Map<CollectionName, List<Map<String, Object>>> data) {
        data.forEach((collection, items) -> {
            if (items.size() > limits.maxEntitiesPerCollection()) {
                throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "Demasiados registros en " + collection.path());
            }
            for (int i = 0; i < items.size(); i++) {
                Object id = items.get(i).get("id");
                try {
                    validate(collection, id instanceof String s ? s : "", items.get(i));
                } catch (ApiException e) {
                    throw ApiException.badRequest("Copia no válida en " + collection.path() + "[" + i + "]: " + e.getMessage(), prefixed(collection, i, e.getFieldErrors()));
                }
            }
        });
        for (CollectionName c : CollectionName.values()) {
            repo.deleteByUserIdAndCollection(userId, c);
            List<EntityDocument> docs = data.getOrDefault(c, List.of()).stream()
                    .map(item -> new EntityDocument(userId, c, (String) item.get("id"), item))
                    .toList();
            repo.saveAll(docs);
        }
    }

    public Map<CollectionName, List<Map<String, Object>>> exportAll(String userId) {
        Map<CollectionName, List<Map<String, Object>>> out = new EnumMap<>(CollectionName.class);
        for (CollectionName c : CollectionName.values()) out.put(c, list(userId, c));
        return out;
    }

    void validate(CollectionName collection, String entityId, Map<String, Object> body) {
        checkId(entityId);
        if (body == null) throw ApiException.badRequest("Cuerpo vacío", Map.of());
        if (!entityId.equals(body.get("id"))) {
            throw ApiException.badRequest("El id del cuerpo no coincide con la URL", Map.of("id", "No coincide con la URL"));
        }
        if (collection == CollectionName.PROFILE && !PROFILE_ID.equals(entityId)) {
            throw ApiException.badRequest("El perfil debe tener id «me»", Map.of("id", "Debe ser «me»"));
        }
        if (hasOperatorKeys(body)) throw ApiException.badRequest("Nombres de campo no permitidos", Map.of());
        if (sizeOf(body) > limits.maxEntityBytes()) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "El registro es demasiado grande");
        }
        EntityValidator v = validators.get(collection);
        Map<String, String> errors = v == null ? Map.of() : v.check(entityId, body);
        if (!errors.isEmpty()) throw ApiException.badRequest("Datos no válidos", errors);
    }

    private static void checkId(String entityId) {
        if (entityId == null || !ID.matcher(entityId).matches()) {
            throw ApiException.badRequest("Identificador no válido", Map.of("id", "Identificador no válido"));
        }
    }

    /** MongoDB treats keys starting with '$' as operators; they are never valid client data. */
    private static boolean hasOperatorKeys(Object node) {
        if (node instanceof Map<?, ?> m) {
            for (var e : m.entrySet()) {
                if (String.valueOf(e.getKey()).startsWith("$") || hasOperatorKeys(e.getValue())) return true;
            }
        } else if (node instanceof List<?> l) {
            for (Object o : l) if (hasOperatorKeys(o)) return true;
        }
        return false;
    }

    private int sizeOf(Map<String, Object> body) {
        try {
            return mapper.writeValueAsBytes(body).length;
        } catch (JsonProcessingException e) {
            throw ApiException.badRequest("JSON no válido", Map.of());
        }
    }

    private static Map<String, String> prefixed(CollectionName c, int i, Map<String, String> errors) {
        Map<String, String> out = new LinkedHashMap<>();
        errors.forEach((k, v) -> out.put(c.path() + "." + i + "." + k, v));
        return out;
    }
}
