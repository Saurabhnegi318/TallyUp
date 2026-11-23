package com.tallyup.expense.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExpenseChangedEvent {
    private UUID eventId;
    private String eventType; // EXPENSE_CREATED, EXPENSE_UPDATED, EXPENSE_DELETED
    private UUID groupId;
    private UUID expenseId;
    private Instant occurredAt;
}
