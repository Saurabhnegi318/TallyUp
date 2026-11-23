package com.tallyup.settlement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.tallyup.settlement.client.ExpenseServiceClient;
import com.tallyup.settlement.dto.SettlementDTOs.*;
import com.tallyup.settlement.entity.Settlement;
import com.tallyup.settlement.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SettlementService {

    private final SettlementRepository settlementRepository;
    private final ExpenseServiceClient expenseServiceClient;
    private final DebtSimplificationService debtSimplificationService;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    private static final String REDIS_KEY_PREFIX = "group:balances:";
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    @Transactional
    public SettlementResponse recordSettlement(RecordSettlementRequest request) {
        Settlement settlement = Settlement.builder()
                .groupId(request.getGroupId())
                .payerMemberId(request.getPayerMemberId())
                .receiverMemberId(request.getReceiverMemberId())
                .amount(request.getAmount().setScale(2, RoundingMode.HALF_UP))
                .notes(request.getNotes())
                .build();

        Settlement saved = settlementRepository.save(settlement);

        // Invalidate and recalculate cache
        recalculateAndCacheBalances(request.getGroupId());

        return mapToResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<SettlementResponse> getGroupSettlements(UUID groupId) {
        return settlementRepository.findByGroupIdOrderBySettledAtDesc(groupId).stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    /**
     * Fast-read path: serves pre-computed balances from Redis in <10ms,
     * falling back to on-demand computation on cache miss.
     */
    public GroupBalanceReport getGroupBalances(UUID groupId) {
        String cacheKey = REDIS_KEY_PREFIX + groupId;
        try {
            String cachedJson = redisTemplate.opsForValue().get(cacheKey);
            if (cachedJson != null && !cachedJson.isBlank()) {
                return objectMapper.readValue(cachedJson, GroupBalanceReport.class);
            }
        } catch (Exception e) {
            log.warn("Redis cache read failed for key {}: {}", cacheKey, e.getMessage());
        }

        // Cache miss -> recalculate on demand
        return recalculateAndCacheBalances(groupId);
    }

    public GroupBalanceReport recalculateAndCacheBalances(UUID groupId) {
        // 1. Fetch expense summary from expense-service
        GroupExpenseSummary expenseSummary;
        try {
            expenseSummary = expenseServiceClient.getGroupSummary(groupId);
        } catch (Exception e) {
            log.error("Failed to fetch expense summary from expense-service for group {}: {}", groupId, e.getMessage());
            expenseSummary = new GroupExpenseSummary(groupId, Collections.emptyList());
        }

        // 2. Fetch all settlements for this group
        List<Settlement> settlements = settlementRepository.findByGroupIdOrderBySettledAtDesc(groupId);

        // 3. Compute net balance per member:
        // NetBalance = TotalExpensesPaid - TotalExpenseSharesOwed + TotalSettlementsPaid - TotalSettlementsReceived
        Map<UUID, BigDecimal> netBalances = new HashMap<>();

        if (expenseSummary != null && expenseSummary.getSummaries() != null) {
            for (MemberLedgerSummary s : expenseSummary.getSummaries()) {
                BigDecimal paid = s.getTotalPaid() != null ? s.getTotalPaid() : BigDecimal.ZERO;
                BigDecimal owed = s.getTotalOwed() != null ? s.getTotalOwed() : BigDecimal.ZERO;
                netBalances.put(s.getMemberId(), paid.subtract(owed));
            }
        }

        for (Settlement s : settlements) {
            netBalances.merge(s.getPayerMemberId(), s.getAmount(), BigDecimal::add);
            netBalances.merge(s.getReceiverMemberId(), s.getAmount().negate(), BigDecimal::add);
        }

        // 4. Simplify debts via Min-Cash-Flow algorithm
        List<SimplifiedTransfer> simplifiedDebts = debtSimplificationService.simplifyDebts(netBalances);

        List<MemberBalance> memberBalances = netBalances.entrySet().stream()
                .map(e -> MemberBalance.builder()
                        .memberId(e.getKey())
                        .netBalance(e.getValue().setScale(2, RoundingMode.HALF_UP))
                        .build())
                .collect(Collectors.toList());

        GroupBalanceReport report = GroupBalanceReport.builder()
                .groupId(groupId)
                .netBalances(memberBalances)
                .simplifiedDebts(simplifiedDebts)
                .build();

        // 5. Overwrite Redis cache
        String cacheKey = REDIS_KEY_PREFIX + groupId;
        try {
            String json = objectMapper.writeValueAsString(report);
            redisTemplate.opsForValue().set(cacheKey, json, CACHE_TTL);
            log.info("Cached balance report for group {} in Redis", groupId);
        } catch (Exception e) {
            log.warn("Failed to write to Redis for key {}: {}", cacheKey, e.getMessage());
        }

        return report;
    }

    private SettlementResponse mapToResponse(Settlement s) {
        return SettlementResponse.builder()
                .id(s.getId())
                .groupId(s.getGroupId())
                .payerMemberId(s.getPayerMemberId())
                .receiverMemberId(s.getReceiverMemberId())
                .amount(s.getAmount())
                .notes(s.getNotes())
                .settledAt(s.getSettledAt())
                .build();
    }
}
