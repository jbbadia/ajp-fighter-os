package com.ajp.fighteros.data.validation;

import com.ajp.fighteros.data.CollectionName;
import java.util.Map;

/** Shape and range rules for one collection's entities. */
public interface EntityValidator {

    CollectionName collection();

    void validate(String entityId, FieldChecker c);

    /** Convenience for tests and services. */
    default Map<String, String> check(String entityId, Map<String, Object> body) {
        FieldChecker c = new FieldChecker(body);
        validate(entityId, c);
        return c.errors();
    }
}
