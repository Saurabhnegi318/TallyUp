package com.tallyup.settlement.service;

import com.tallyup.settlement.dto.SettlementDTOs.SimplifiedTransfer;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;

@Service
public class DebtSimplificationService {

    @Getter
    @AllArgsConstructor
    public static class BalanceEntry {
        private final UUID memberId;
        private BigDecimal balance; // positive for creditor, absolute positive for debtor in debtor heap
    }

    /**
     * Executes greedy Min-Cash-Flow debt simplification algorithm
     * using two Max-Heaps (PriorityQueue).
     *
     * Produces at most N - 1 direct settlement transactions.
     */
    public List<SimplifiedTransfer> simplifyDebts(Map<UUID, BigDecimal> netBalances) {
        List<SimplifiedTransfer> result = new ArrayList<>();

        // PriorityQueue (Max-Heap) for creditors (balance > 0)
        PriorityQueue<BalanceEntry> creditors = new PriorityQueue<>(
                (a, b) -> b.getBalance().compareTo(a.getBalance())
        );

        // PriorityQueue (Max-Heap) for debtors (|balance|, ordered largest debt first)
        PriorityQueue<BalanceEntry> debtors = new PriorityQueue<>(
                (a, b) -> b.getBalance().compareTo(a.getBalance())
        );

        BigDecimal threshold = new BigDecimal("0.005");

        netBalances.forEach((memberId, balance) -> {
            BigDecimal rounded = balance.setScale(2, RoundingMode.HALF_UP);
            if (rounded.compareTo(threshold) > 0) {
                creditors.offer(new BalanceEntry(memberId, rounded));
            } else if (rounded.compareTo(threshold.negate()) < 0) {
                debtors.offer(new BalanceEntry(memberId, rounded.abs()));
            }
        });

        while (!creditors.isEmpty() && !debtors.isEmpty()) {
            BalanceEntry creditor = creditors.poll();
            BalanceEntry debtor = debtors.poll();

            BigDecimal transferAmount = creditor.getBalance().min(debtor.getBalance());

            result.add(SimplifiedTransfer.builder()
                    .fromMemberId(debtor.getMemberId())
                    .toMemberId(creditor.getMemberId())
                    .amount(transferAmount.setScale(2, RoundingMode.HALF_UP))
                    .build());

            BigDecimal creditorRemainder = creditor.getBalance().subtract(transferAmount);
            BigDecimal debtorRemainder = debtor.getBalance().subtract(transferAmount);

            if (creditorRemainder.compareTo(threshold) > 0) {
                creditors.offer(new BalanceEntry(creditor.getMemberId(), creditorRemainder));
            }
            if (debtorRemainder.compareTo(threshold) > 0) {
                debtors.offer(new BalanceEntry(debtor.getMemberId(), debtorRemainder));
            }
        }

        return result;
    }
}
