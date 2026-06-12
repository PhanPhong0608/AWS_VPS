package com.vpsrental.repository;

import com.vpsrental.entity.User;
import com.vpsrental.entity.VpsInstance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface VpsInstanceRepository extends JpaRepository<VpsInstance, Long> {
    List<VpsInstance> findByOwner(User owner);
    Optional<VpsInstance> findByInstanceId(String instanceId);
    List<VpsInstance> findByExpiryDateBeforeAndStatusNot(LocalDateTime dateTime, String status);
}
