package com.ajp.fighteros.data;

import java.time.Instant;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One client entity (session, check-in, technique…) owned by a user.
 * The payload is stored as a sub-document so the schema can evolve with the app;
 * its shape is enforced by {@link com.ajp.fighteros.data.validation.EntityValidator}s.
 */
@Document("entities")
@CompoundIndex(name = "owner_collection_entity", def = "{'userId': 1, 'collection': 1, 'entityId': 1}", unique = true)
public class EntityDocument {

    @Id
    private String id;

    private String userId;
    private CollectionName collection;
    private String entityId;
    private Map<String, Object> data;
    private Instant createdAt;
    private Instant updatedAt;

    protected EntityDocument() {}

    public EntityDocument(String userId, CollectionName collection, String entityId, Map<String, Object> data) {
        this.userId = userId;
        this.collection = collection;
        this.entityId = entityId;
        this.data = data;
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public void replaceData(Map<String, Object> data) {
        this.data = data;
        this.updatedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public CollectionName getCollection() { return collection; }
    public String getEntityId() { return entityId; }
    public Map<String, Object> getData() { return data; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
