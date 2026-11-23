package com.tallyup.group.dto;

import com.tallyup.group.entity.MemberRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class GroupDTOs {

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CreateGroupRequest {
        @NotBlank(message = "Group name is required")
        @Size(max = 120)
        private String name;

        private String currencyCode = "INR";
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GroupResponse {
        private UUID id;
        private String name;
        private String currencyCode;
        private String inviteCode;
        private UUID createdBy;
        private Boolean isArchived;
        private List<MemberResponse> members;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class MemberResponse {
        private UUID id;
        private UUID userId;
        private String displayName;
        private MemberRole role;
        private Instant joinedAt;
        private Boolean isVirtual;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AddMemberRequest {
        @NotBlank(message = "Display name is required")
        @Size(max = 100)
        private String displayName;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ClaimMemberRequest {
        private UUID memberId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class InviteDetailsResponse {
        private UUID groupId;
        private String groupName;
        private String currencyCode;
        private List<MemberResponse> unclaimedMembers;
    }
}
