package com.tallyup.settlement.client;

import com.tallyup.settlement.dto.SettlementDTOs.GroupExpenseSummary;
import org.springframework.cloud.openfeign.FeignClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.UUID;

@FeignClient(name = "expense-service", url = "${EXPENSE_SERVICE_URL:http://localhost:8082}")
public interface ExpenseServiceClient {

    @GetMapping("/internal/expenses/group/{groupId}/summary")
    GroupExpenseSummary getGroupSummary(@PathVariable("groupId") UUID groupId);
}
