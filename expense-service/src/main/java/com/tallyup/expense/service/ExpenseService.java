package com.tallyup.expense.service;

import com.tallyup.expense.dto.ExpenseDTOs.*;
import com.tallyup.expense.entity.Expense;
import com.tallyup.expense.entity.ExpenseSplit;
import com.tallyup.expense.entity.SplitType;
import com.tallyup.expense.event.ExpenseChangedEvent;
import com.tallyup.expense.repository.ExpenseRepository;
import com.tallyup.expense.repository.ExpenseSplitRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExpenseSplitRepository splitRepository;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public static final String TOPIC_EXPENSE_EVENTS = "tallyup.expense.events";

    @Transactional
    public ExpenseResponse createExpense(CreateExpenseRequest request) {
        if (request.getSplits() == null || request.getSplits().isEmpty()) {
            throw new IllegalArgumentException("At least one split member must be specified");
        }

        BigDecimal total = request.getTotalAmount().setScale(2, RoundingMode.HALF_UP);

        Expense expense = Expense.builder()
                .groupId(request.getGroupId())
                .paidByMemberId(request.getPaidByMemberId())
                .title(request.getTitle().trim())
                .totalAmount(total)
                .splitType(request.getSplitType() != null ? request.getSplitType() : SplitType.EQUAL)
                .category(request.getCategory())
                .expenseDate(request.getExpenseDate())
                .build();

        List<ExpenseSplit> splits = calculateSplits(expense, request.getSplits(), total, expense.getSplitType());
        expense.setSplits(splits);

        Expense saved = expenseRepository.save(expense);

        // Publish Kafka Event
        publishExpenseEvent("EXPENSE_CREATED", saved.getGroupId(), saved.getId());

        return mapToResponse(saved);
    }

    private List<ExpenseSplit> calculateSplits(Expense expense, List<SplitDetail> inputSplits, BigDecimal total, SplitType splitType) {
        List<ExpenseSplit> result = new ArrayList<>();
        int count = inputSplits.size();

        if (splitType == SplitType.EQUAL) {
            // Penny-exact equal split distribution
            BigDecimal countBd = BigDecimal.valueOf(count);
            BigDecimal baseShare = total.divide(countBd, 2, RoundingMode.DOWN);
            BigDecimal distributed = baseShare.multiply(countBd);
            BigDecimal remainder = total.subtract(distributed);

            for (int i = 0; i < count; i++) {
                SplitDetail detail = inputSplits.get(i);
                BigDecimal share = baseShare;
                if (i == 0) {
                    // Remainder penny allocated to first participant
                    share = share.add(remainder);
                }
                result.add(ExpenseSplit.builder()
                        .expense(expense)
                        .memberId(detail.getMemberId())
                        .owedAmount(share)
                        .build());
            }
        } else if (splitType == SplitType.EXACT) {
            BigDecimal sum = BigDecimal.ZERO;
            for (SplitDetail detail : inputSplits) {
                if (detail.getOwedAmount() == null || detail.getOwedAmount().compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("Exact owed amount cannot be negative or null");
                }
                BigDecimal owed = detail.getOwedAmount().setScale(2, RoundingMode.HALF_UP);
                sum = sum.add(owed);
                result.add(ExpenseSplit.builder()
                        .expense(expense)
                        .memberId(detail.getMemberId())
                        .owedAmount(owed)
                        .build());
            }
            if (sum.compareTo(total) != 0) {
                throw new IllegalArgumentException("Sum of exact splits (" + sum + ") must equal total bill amount (" + total + ")");
            }
        } else if (splitType == SplitType.PERCENTAGE) {
            BigDecimal sumPercentage = BigDecimal.ZERO;
            for (SplitDetail detail : inputSplits) {
                if (detail.getShareValue() == null || detail.getShareValue().compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("Percentage share cannot be negative or null");
                }
                sumPercentage = sumPercentage.add(detail.getShareValue());
            }

            // Sum of percentages must equal 100.00%
            if (sumPercentage.setScale(2, RoundingMode.HALF_UP).compareTo(new BigDecimal("100.00")) != 0) {
                throw new IllegalArgumentException("Sum of percentage splits (" + sumPercentage + "%) must equal 100%");
            }

            BigDecimal sumCalculatedOwed = BigDecimal.ZERO;
            int firstNonZeroIndex = -1;

            for (int i = 0; i < count; i++) {
                SplitDetail detail = inputSplits.get(i);
                BigDecimal pct = detail.getShareValue();
                BigDecimal owed = total.multiply(pct).divide(BigDecimal.valueOf(100), 2, RoundingMode.DOWN);
                sumCalculatedOwed = sumCalculatedOwed.add(owed);
                if (firstNonZeroIndex == -1 && pct.compareTo(BigDecimal.ZERO) > 0) {
                    firstNonZeroIndex = i;
                }
                result.add(ExpenseSplit.builder()
                        .expense(expense)
                        .memberId(detail.getMemberId())
                        .owedAmount(owed)
                        .shareValue(pct)
                        .build());
            }

            // Penny-exact correction for rounding discrepancies
            BigDecimal remainder = total.subtract(sumCalculatedOwed);
            if (remainder.compareTo(BigDecimal.ZERO) != 0 && firstNonZeroIndex >= 0) {
                ExpenseSplit target = result.get(firstNonZeroIndex);
                target.setOwedAmount(target.getOwedAmount().add(remainder));
            }
        } else if (splitType == SplitType.SHARES) {
            BigDecimal totalShares = BigDecimal.ZERO;
            for (SplitDetail detail : inputSplits) {
                if (detail.getShareValue() == null || detail.getShareValue().compareTo(BigDecimal.ZERO) < 0) {
                    throw new IllegalArgumentException("Share value cannot be negative or null");
                }
                totalShares = totalShares.add(detail.getShareValue());
            }
            if (totalShares.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Total shares must be strictly positive");
            }

            BigDecimal sumCalculatedOwed = BigDecimal.ZERO;
            int firstNonZeroIndex = -1;
            for (int i = 0; i < count; i++) {
                SplitDetail detail = inputSplits.get(i);
                BigDecimal shares = detail.getShareValue();
                BigDecimal owed = total.multiply(shares).divide(totalShares, 2, RoundingMode.DOWN);
                sumCalculatedOwed = sumCalculatedOwed.add(owed);
                if (firstNonZeroIndex == -1 && shares.compareTo(BigDecimal.ZERO) > 0) {
                    firstNonZeroIndex = i;
                }
                result.add(ExpenseSplit.builder()
                        .expense(expense)
                        .memberId(detail.getMemberId())
                        .owedAmount(owed)
                        .shareValue(shares)
                        .build());
            }

            BigDecimal remainder = total.subtract(sumCalculatedOwed);
            if (remainder.compareTo(BigDecimal.ZERO) != 0 && firstNonZeroIndex >= 0) {
                ExpenseSplit target = result.get(firstNonZeroIndex);
                target.setOwedAmount(target.getOwedAmount().add(remainder));
            }
        } else {
            throw new UnsupportedOperationException("Unsupported split type: " + splitType);
        }

        return result;
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> getGroupExpenses(UUID groupId) {
        return expenseRepository.findByGroupIdOrderByExpenseDateDescCreatedAtDesc(groupId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteExpense(UUID expenseId) {
        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new IllegalArgumentException("Expense not found"));
        UUID groupId = expense.getGroupId();
        expenseRepository.delete(expense);
        publishExpenseEvent("EXPENSE_DELETED", groupId, expenseId);
    }

    @Transactional(readOnly = true)
    public GroupExpenseSummary getGroupSummary(UUID groupId) {
        List<Expense> expenses = expenseRepository.findByGroupIdOrderByExpenseDateDescCreatedAtDesc(groupId);

        Map<UUID, BigDecimal> paidMap = new HashMap<>();
        Map<UUID, BigDecimal> owedMap = new HashMap<>();

        for (Expense exp : expenses) {
            paidMap.merge(exp.getPaidByMemberId(), exp.getTotalAmount(), BigDecimal::add);
            for (ExpenseSplit split : exp.getSplits()) {
                owedMap.merge(split.getMemberId(), split.getOwedAmount(), BigDecimal::add);
            }
        }

        Set<UUID> allMemberIds = new HashSet<>();
        allMemberIds.addAll(paidMap.keySet());
        allMemberIds.addAll(owedMap.keySet());

        List<MemberLedgerSummary> summaries = allMemberIds.stream()
                .map(memberId -> MemberLedgerSummary.builder()
                        .memberId(memberId)
                        .totalPaid(paidMap.getOrDefault(memberId, BigDecimal.ZERO))
                        .totalOwed(owedMap.getOrDefault(memberId, BigDecimal.ZERO))
                        .build())
                .collect(Collectors.toList());

        return GroupExpenseSummary.builder()
                .groupId(groupId)
                .summaries(summaries)
                .build();
    }

    private void publishExpenseEvent(String eventType, UUID groupId, UUID expenseId) {
        CompletableFuture.runAsync(() -> {
            try {
                ExpenseChangedEvent event = ExpenseChangedEvent.builder()
                        .eventId(UUID.randomUUID())
                        .eventType(eventType)
                        .groupId(groupId)
                        .expenseId(expenseId)
                        .occurredAt(Instant.now())
                        .build();

                kafkaTemplate.send(TOPIC_EXPENSE_EVENTS, groupId.toString(), event);
                log.info("Published {} event for group: {}", eventType, groupId);
            } catch (Exception e) {
                log.warn("Kafka event publishing skipped for group {}: {}", groupId, e.getMessage());
            }
        });
    }

    private ExpenseResponse mapToResponse(Expense expense) {
        List<SplitDetail> splits = expense.getSplits().stream()
                .map(s -> SplitDetail.builder()
                        .memberId(s.getMemberId())
                        .owedAmount(s.getOwedAmount())
                        .shareValue(s.getShareValue())
                        .build())
                .collect(Collectors.toList());

        return ExpenseResponse.builder()
                .id(expense.getId())
                .groupId(expense.getGroupId())
                .paidByMemberId(expense.getPaidByMemberId())
                .title(expense.getTitle())
                .totalAmount(expense.getTotalAmount())
                .splitType(expense.getSplitType())
                .category(expense.getCategory())
                .expenseDate(expense.getExpenseDate())
                .createdAt(expense.getCreatedAt())
                .splits(splits)
                .build();
    }
}
