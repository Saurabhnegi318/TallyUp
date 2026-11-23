package com.tallyup.settlement.controller;

import com.tallyup.settlement.dto.SettlementDTOs.*;
import com.tallyup.settlement.service.SettlementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/settlements")
@RequiredArgsConstructor
public class SettlementController {

    private final SettlementService settlementService;

    @GetMapping("/group/{groupId}")
    public ResponseEntity<GroupBalanceReport> getGroupBalances(@PathVariable UUID groupId) {
        return ResponseEntity.ok(settlementService.getGroupBalances(groupId));
    }

    @GetMapping("/group/{groupId}/history")
    public ResponseEntity<List<SettlementResponse>> getGroupSettlementHistory(@PathVariable UUID groupId) {
        return ResponseEntity.ok(settlementService.getGroupSettlements(groupId));
    }

    @PostMapping
    public ResponseEntity<SettlementResponse> recordSettlement(@Valid @RequestBody RecordSettlementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(settlementService.recordSettlement(request));
    }
}
