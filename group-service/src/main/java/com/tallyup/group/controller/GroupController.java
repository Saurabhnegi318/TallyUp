package com.tallyup.group.controller;

import com.tallyup.group.dto.GroupDTOs.*;
import com.tallyup.group.service.GroupService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;

    @PostMapping
    public ResponseEntity<GroupResponse> createGroup(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @Valid @RequestBody CreateGroupRequest request) {
        UUID userId = userIdHeader != null ? UUID.fromString(userIdHeader) : null;
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.createGroup(request, userId));
    }

    @GetMapping
    public ResponseEntity<List<GroupResponse>> getUserGroups(
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader) {
        UUID userId = userIdHeader != null ? UUID.fromString(userIdHeader) : null;
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(groupService.getUserGroups(userId));
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<GroupResponse> getGroup(@PathVariable UUID groupId) {
        return ResponseEntity.ok(groupService.getGroup(groupId));
    }

    @GetMapping("/invite/{inviteCode}")
    public ResponseEntity<InviteDetailsResponse> getInviteDetails(@PathVariable String inviteCode) {
        return ResponseEntity.ok(groupService.getInviteDetails(inviteCode));
    }

    @PostMapping("/{groupId}/members")
    public ResponseEntity<MemberResponse> addMember(
            @PathVariable UUID groupId,
            @Valid @RequestBody AddMemberRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(groupService.addVirtualMember(groupId, request));
    }

    @PostMapping("/{groupId}/members/claim")
    public ResponseEntity<MemberResponse> claimMember(
            @PathVariable UUID groupId,
            @RequestHeader(value = "X-User-Id", required = false) String userIdHeader,
            @RequestBody ClaimMemberRequest request) {
        UUID userId = userIdHeader != null ? UUID.fromString(userIdHeader) : null;
        if (userId == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(groupService.claimVirtualMember(groupId, request.getMemberId(), userId));
    }
}
