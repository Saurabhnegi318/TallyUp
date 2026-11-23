package com.tallyup.settlement.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class SettlementDTOs {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RecordSettlementRequest {
        @NotNull(message = "Group ID is required")
        private UUID groupId;

        @NotNull(message = "Payer member ID is required")
        private UUID payerMemberId;

        @NotNull(message = "Receiver member ID is required")
        private UUID receiverMemberId;

        @NotNull(message = "Amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be strictly positive")
        private BigDecimal amount;

        private String notes;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SettlementResponse implements Serializable {
        private UUID id;
        private UUID groupId;
        private UUID payerMemberId;
        private UUID receiverMemberId;
        private BigDecimal amount;
        private String notes;
        private Instant settledAt;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SimplifiedTransfer implements Serializable {
        private UUID fromMemberId;
        private UUID toMemberId;
        private BigDecimal amount;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberBalance implements Serializable {
        private UUID memberId;
        private BigDecimal netBalance;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupBalanceReport implements Serializable {
        private UUID groupId;
        private List<MemberBalance> netBalances;
        private List<SimplifiedTransfer> simplifiedDebts;
    }

    // Matching DTO from expense-service
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class MemberLedgerSummary {
        private UUID memberId;
        private BigDecimal totalPaid;
        private BigDecimal totalOwed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class GroupExpenseSummary {
        private UUID groupId;
        private List<MemberLedgerSummary> summaries;
    }
}
