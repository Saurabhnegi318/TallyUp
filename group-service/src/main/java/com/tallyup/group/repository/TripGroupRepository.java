package com.tallyup.group.repository;

import com.tallyup.group.entity.TripGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface TripGroupRepository extends JpaRepository<TripGroup, UUID> {
    Optional<TripGroup> findByInviteCode(String inviteCode);

    @Query("SELECT g FROM TripGroup g JOIN g.members m WHERE m.userId = :userId AND g.isArchived = false")
    List<TripGroup> findAllByUserId(@Param("userId") UUID userId);
}
