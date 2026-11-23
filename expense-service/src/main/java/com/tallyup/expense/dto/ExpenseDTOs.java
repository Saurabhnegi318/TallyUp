package com.tallyup.expense.dto;

import com.tallyup.expense.entity.ExpenseCategory;
import com.tallyup.expense.entity.SplitType;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class ExpenseDTOs {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CreateExpenseRequest {
        @NotNull(message = "Group ID is required")
        private UUID groupId;

        @NotNull(message = "Paid by member ID is required")
        private UUID paidByMemberId;

        @NotBlank(message = "Title is required")
        @Size(max = 200)
        private String title;

        @NotNull(message = "Total amount is required")
        @DecimalMin(value = "0.01", message = "Amount must be strictly positive")
        private BigDecimal totalAmount;

        private SplitType splitType = SplitType.EQUAL;
        private ExpenseCategory category = ExpenseCategory.GENERAL;
        private LocalDate expenseDate = LocalDate.now();

        // For EQUAL split: list of member IDs who share the expense
        // For EXACT split: list of SplitDetail with specific owedAmounts
        private List<SplitDetail> splits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SplitDetail {
        private UUID memberId;
        private BigDecimal owedAmount;
        private BigDecimal shareValue;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ExpenseResponse {
        private UUID id;
        private UUID groupId;
        private UUID paidByMemberId;
        private String title;
        private BigDecimal totalAmount;
        private SplitType splitType;
        private ExpenseCategory category;
        private LocalDate expenseDate;
        private Instant createdAt;
        private List<SplitDetail> splits;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberLedgerSummary {
        private UUID memberId;
        private BigDecimal totalPaid;
        private BigDecimal totalOwed;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupExpenseSummary {
        private UUID groupId;
        private List<MemberLedgerSummary> summaries;
    }
}
