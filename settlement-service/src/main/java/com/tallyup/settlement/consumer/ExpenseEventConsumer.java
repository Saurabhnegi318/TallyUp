package com.tallyup.settlement.consumer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tallyup.settlement.entity.ProcessedEvent;
import com.tallyup.settlement.repository.ProcessedEventRepository;
import com.tallyup.settlement.service.SettlementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class ExpenseEventConsumer {

    private final ProcessedEventRepository processedEventRepository;
    private final SettlementService settlementService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "tallyup.expense.events", groupId = "settlement-service-group")
    @Transactional
    public void consumeExpenseEvent(String message) {
        try {
            JsonNode root = objectMapper.readTree(message);
            UUID eventId = UUID.fromString(root.get("eventId").asText());
            UUID groupId = UUID.fromString(root.get("groupId").asText());
            String eventType = root.get("eventType").asText();

            log.info("Received event: {} for group: {}, eventId: {}", eventType, groupId, eventId);

            // Idempotency check
            if (processedEventRepository.existsByEventId(eventId)) {
                log.info("Event {} already processed. Skipping.", eventId);
                return;
            }

            // Record processed event
            processedEventRepository.save(ProcessedEvent.builder()
                    .eventId(eventId)
                    .groupId(groupId)
                    .eventType(eventType)
                    .build());

            // Recalculate and update Redis cache
            settlementService.recalculateAndCacheBalances(groupId);

        } catch (Exception e) {
            log.error("Failed to process Kafka expense event: {}", message, e);
        }
    }
}
