package com.vpsrental.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "vps_instances")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VpsInstance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", unique = true)
    private String instanceId; // AWS EC2 Instance ID (nullable initially during provisioning)

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User owner;

    @Column(name = "instance_type", nullable = false)
    private String instanceType; // t2.micro, t3.micro, etc.

    @Column(name = "os_type", nullable = false)
    private String osType; // UBUNTU, WINDOWS, etc.

    @Column(name = "ami_id", nullable = false)
    private String amiId;

    @Column(name = "public_ip")
    private String publicIp;

    @Column(nullable = false)
    private String status; // PENDING, RUNNING, STOPPING, STOPPED, TERMINATED

    @Column(name = "monthly_price", nullable = false)
    private BigDecimal monthlyPrice;

    @Column(name = "expiry_date", nullable = false)
    private LocalDateTime expiryDate;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) {
            status = "PENDING";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
