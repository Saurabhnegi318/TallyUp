package com.tallyup.settlement.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "settlements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Settlement {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "group_id", nullable = false)
    private UUID groupId;

    @Column(name = "payer_member_id", nullable = false)
    private UUID payerMemberId;

    @Column(name = "receiver_member_id", nullable = false)
    private UUID receiverMemberId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(length = 255)
    private String notes;

    @Column(name = "settled_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant settledAt = Instant.now();
}
