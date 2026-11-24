package com.tallyup.expense.service;

import com.tallyup.expense.dto.ExpenseDTOs.*;
import com.tallyup.expense.entity.Expense;
import com.tallyup.expense.entity.SplitType;
import com.tallyup.expense.repository.ExpenseRepository;
import com.tallyup.expense.repository.ExpenseSplitRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock
    private ExpenseRepository expenseRepository;

    @Mock
    private ExpenseSplitRepository splitRepository;

    @Mock
    private KafkaTemplate<String, Object> kafkaTemplate;

    @InjectMocks
    private ExpenseService expenseService;

    private UUID groupId;
    private UUID payerId;
    private UUID member1;
    private UUID member2;
    private UUID member3;

    @BeforeEach
    void setUp() {
        groupId = UUID.randomUUID();
        payerId = UUID.randomUUID();
        member1 = UUID.randomUUID();
        member2 = UUID.randomUUID();
        member3 = UUID.randomUUID();
    }

    @Test
    @DisplayName("Equal split of 100.00 among 3 members must allocate remainder penny to first member (33.34, 33.33, 33.33)")
    void testPennyExactEqualSplitDistribution() {
        CreateExpenseRequest request = CreateExpenseRequest.builder()
                .groupId(groupId)
                .paidByMemberId(payerId)
                .title("Dinner")
                .totalAmount(new BigDecimal("100.00"))
                .splitType(SplitType.EQUAL)
                .splits(List.of(
                        SplitDetail.builder().memberId(member1).build(),
                        SplitDetail.builder().memberId(member2).build(),
                        SplitDetail.builder().memberId(member3).build()
                ))
                .build();

        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ExpenseResponse response = expenseService.createExpense(request);

        assertNotNull(response);
        assertEquals(3, response.getSplits().size());

        BigDecimal s1 = response.getSplits().get(0).getOwedAmount();
        BigDecimal s2 = response.getSplits().get(1).getOwedAmount();
        BigDecimal s3 = response.getSplits().get(2).getOwedAmount();

        assertEquals(new BigDecimal("33.34"), s1);
        assertEquals(new BigDecimal("33.33"), s2);
        assertEquals(new BigDecimal("33.33"), s3);

        BigDecimal sum = s1.add(s2).add(s3);
        assertEquals(new BigDecimal("100.00"), sum);
    }

    @Test
    @DisplayName("Exact split with valid custom amounts (50.00, 30.00, 20.00 = 100.00)")
    void testExactSplitValid() {
        CreateExpenseRequest request = CreateExpenseRequest.builder()
                .groupId(groupId)
                .paidByMemberId(payerId)
                .title("Groceries")
                .totalAmount(new BigDecimal("100.00"))
                .splitType(SplitType.EXACT)
                .splits(List.of(
                        SplitDetail.builder().memberId(member1).owedAmount(new BigDecimal("50.00")).build(),
                        SplitDetail.builder().memberId(member2).owedAmount(new BigDecimal("30.00")).build(),
                        SplitDetail.builder().memberId(member3).owedAmount(new BigDecimal("20.00")).build()
                ))
                .build();

        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ExpenseResponse response = expenseService.createExpense(request);

        assertNotNull(response);
        assertEquals(3, response.getSplits().size());
        assertEquals(new BigDecimal("50.00"), response.getSplits().get(0).getOwedAmount());
        assertEquals(new BigDecimal("30.00"), response.getSplits().get(1).getOwedAmount());
        assertEquals(new BigDecimal("20.00"), response.getSplits().get(2).getOwedAmount());
    }

    @Test
    @DisplayName("Exact split with invalid sum must throw IllegalArgumentException")
    void testExactSplitInvalidSum() {
        CreateExpenseRequest request = CreateExpenseRequest.builder()
                .groupId(groupId)
                .paidByMemberId(payerId)
                .title("Groceries")
                .totalAmount(new BigDecimal("100.00"))
                .splitType(SplitType.EXACT)
                .splits(List.of(
                        SplitDetail.builder().memberId(member1).owedAmount(new BigDecimal("50.00")).build(),
                        SplitDetail.builder().memberId(member2).owedAmount(new BigDecimal("40.00")).build()
                ))
                .build();

        assertThrows(IllegalArgumentException.class, () -> expenseService.createExpense(request));
    }

    @Test
    @DisplayName("Percentage split with penny-exact correction (33.33%, 33.33%, 33.34% of 100.00)")
    void testPercentageSplitPennyExact() {
        CreateExpenseRequest request = CreateExpenseRequest.builder()
                .groupId(groupId)
                .paidByMemberId(payerId)
                .title("Flight Tickets")
                .totalAmount(new BigDecimal("100.00"))
                .splitType(SplitType.PERCENTAGE)
                .splits(List.of(
                        SplitDetail.builder().memberId(member1).shareValue(new BigDecimal("33.33")).build(),
                        SplitDetail.builder().memberId(member2).shareValue(new BigDecimal("33.33")).build(),
                        SplitDetail.builder().memberId(member3).shareValue(new BigDecimal("33.34")).build()
                ))
                .build();

        when(expenseRepository.save(any(Expense.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ExpenseResponse response = expenseService.createExpense(request);

        assertNotNull(response);
        assertEquals(3, response.getSplits().size());

        BigDecimal s1 = response.getSplits().get(0).getOwedAmount();
        BigDecimal s2 = response.getSplits().get(1).getOwedAmount();
        BigDecimal s3 = response.getSplits().get(2).getOwedAmount();

        BigDecimal sum = s1.add(s2).add(s3);
        assertEquals(new BigDecimal("100.00"), sum);
    }

    @Test
    @DisplayName("Percentage split whose sum is not 100% must throw IllegalArgumentException")
    void testPercentageSplitInvalidTotal() {
        CreateExpenseRequest request = CreateExpenseRequest.builder()
                .groupId(groupId)
                .paidByMemberId(payerId)
                .title("Invalid Split")
                .totalAmount(new BigDecimal("100.00"))
                .splitType(SplitType.PERCENTAGE)
                .splits(List.of(
                        SplitDetail.builder().memberId(member1).shareValue(new BigDecimal("60.00")).build(),
                        SplitDetail.builder().memberId(member2).shareValue(new BigDecimal("30.00")).build()
                ))
                .build();

        assertThrows(IllegalArgumentException.class, () -> expenseService.createExpense(request));
    }
}
