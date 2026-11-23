package com.tallyup.settlement.service;

import com.tallyup.settlement.dto.SettlementDTOs.SimplifiedTransfer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class DebtSimplificationServiceTest {

    private DebtSimplificationService service;

    @BeforeEach
    void setUp() {
        service = new DebtSimplificationService();
    }

    @Test
    @DisplayName("Should simplify debts between 3 members: A(+40), B(-20), C(-20) into 2 transactions")
    void testThreeMemberSimplification() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();

        Map<UUID, BigDecimal> netBalances = new HashMap<>();
        netBalances.put(a, new BigDecimal("40.00"));
        netBalances.put(b, new BigDecimal("-20.00"));
        netBalances.put(c, new BigDecimal("-20.00"));

        List<SimplifiedTransfer> transfers = service.simplifyDebts(netBalances);

        assertNotNull(transfers);
        assertEquals(2, transfers.size());

        BigDecimal totalSettled = transfers.stream()
                .map(SimplifiedTransfer::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertEquals(new BigDecimal("40.00"), totalSettled);

        // Every transfer must be directed to A
        for (SimplifiedTransfer t : transfers) {
            assertEquals(a, t.getToMemberId());
            assertEquals(new BigDecimal("20.00"), t.getAmount());
        }
    }

    @Test
    @DisplayName("Should simplify tangled 4-member balances into at most N - 1 (3) transfers")
    void testFourMemberSimplification() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        UUID d = UUID.randomUUID();

        // Total sum = 0
        // A is creditor +70, B is creditor +30
        // C is debtor -40, D is debtor -60
        Map<UUID, BigDecimal> netBalances = new HashMap<>();
        netBalances.put(a, new BigDecimal("70.00"));
        netBalances.put(b, new BigDecimal("30.00"));
        netBalances.put(c, new BigDecimal("-40.00"));
        netBalances.put(d, new BigDecimal("-60.00"));

        List<SimplifiedTransfer> transfers = service.simplifyDebts(netBalances);

        assertTrue(transfers.size() <= 3, "Transfers must be at most N - 1");

        BigDecimal totalSettled = transfers.stream()
                .map(SimplifiedTransfer::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        assertEquals(new BigDecimal("100.00"), totalSettled);
    }
}
