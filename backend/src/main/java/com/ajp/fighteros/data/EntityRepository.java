package com.ajp.fighteros.data;

import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface EntityRepository extends MongoRepository<EntityDocument, String> {

    List<EntityDocument> findByUserIdAndCollection(String userId, CollectionName collection);

    Optional<EntityDocument> findByUserIdAndCollectionAndEntityId(String userId, CollectionName collection, String entityId);

    long countByUserIdAndCollection(String userId, CollectionName collection);

    long deleteByUserIdAndCollectionAndEntityId(String userId, CollectionName collection, String entityId);

    long deleteByUserIdAndCollection(String userId, CollectionName collection);
}
