package com.tallyup.group.service;

import com.tallyup.group.dto.GroupDTOs.*;
import com.tallyup.group.entity.GroupMember;
import com.tallyup.group.entity.MemberRole;
import com.tallyup.group.entity.TripGroup;
import com.tallyup.group.entity.User;
import com.tallyup.group.repository.GroupMemberRepository;
import com.tallyup.group.repository.TripGroupRepository;
import com.tallyup.group.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class GroupService {

    private final TripGroupRepository tripGroupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final UserRepository userRepository;

    private static final String INVITE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int INVITE_LENGTH = 6;
    private final SecureRandom random = new SecureRandom();

    private String generateInviteCode() {
        StringBuilder sb = new StringBuilder(INVITE_LENGTH);
        for (int i = 0; i < INVITE_LENGTH; i++) {
            sb.append(INVITE_CHARS.charAt(random.nextInt(INVITE_CHARS.length())));
        }
        return sb.toString();
    }

    @Transactional
    public GroupResponse createGroup(CreateGroupRequest request, UUID userId) {
        User creator = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        TripGroup group = TripGroup.builder()
                .name(request.getName().trim())
                .currencyCode(request.getCurrencyCode().toUpperCase())
                .inviteCode(generateInviteCode())
                .createdBy(userId)
                .build();

        TripGroup savedGroup = tripGroupRepository.save(group);

        GroupMember adminMember = GroupMember.builder()
                .group(savedGroup)
                .userId(userId)
                .displayName(creator.getFullName())
                .role(MemberRole.ADMIN)
                .build();

        groupMemberRepository.save(adminMember);
        savedGroup.getMembers().add(adminMember);

        return mapToGroupResponse(savedGroup);
    }

    @Transactional(readOnly = true)
    public List<GroupResponse> getUserGroups(UUID userId) {
        return tripGroupRepository.findAllByUserId(userId).stream()
                .map(this::mapToGroupResponse)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public GroupResponse getGroup(UUID groupId) {
        TripGroup group = tripGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));
        return mapToGroupResponse(group);
    }

    @Transactional(readOnly = true)
    public InviteDetailsResponse getInviteDetails(String inviteCode) {
        TripGroup group = tripGroupRepository.findByInviteCode(inviteCode.trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Invalid invite code"));

        List<MemberResponse> unclaimed = groupMemberRepository.findByGroupIdAndUserIdIsNull(group.getId()).stream()
                .map(this::mapToMemberResponse)
                .collect(Collectors.toList());

        return InviteDetailsResponse.builder()
                .groupId(group.getId())
                .groupName(group.getName())
                .currencyCode(group.getCurrencyCode())
                .unclaimedMembers(unclaimed)
                .build();
    }

    @Transactional
    public GroupResponse joinGroup(String inviteCode, UUID userId) {
        String cleanCode = inviteCode != null ? inviteCode.trim().toUpperCase() : "";
        TripGroup group = tripGroupRepository.findByInviteCode(cleanCode)
                .orElseThrow(() -> new IllegalArgumentException("Invalid invite code: " + cleanCode));

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        List<GroupMember> existingMembers = groupMemberRepository.findByGroupId(group.getId());
        boolean alreadyMember = existingMembers.stream()
                .anyMatch(m -> userId.equals(m.getUserId()));

        if (!alreadyMember) {
            GroupMember newMember = GroupMember.builder()
                    .group(group)
                    .userId(userId)
                    .displayName(user.getFullName())
                    .role(MemberRole.MEMBER)
                    .build();
            groupMemberRepository.save(newMember);
        }

        return getGroup(group.getId());
    }

    @Transactional
    public MemberResponse addVirtualMember(UUID groupId, AddMemberRequest request) {
        TripGroup group = tripGroupRepository.findById(groupId)
                .orElseThrow(() -> new IllegalArgumentException("Group not found"));

        GroupMember member = GroupMember.builder()
                .group(group)
                .displayName(request.getDisplayName().trim())
                .role(MemberRole.MEMBER)
                .build();

        GroupMember saved = groupMemberRepository.save(member);
        return mapToMemberResponse(saved);
    }

    @Transactional
    public MemberResponse claimVirtualMember(UUID groupId, UUID memberId, UUID userId) {
        GroupMember member = groupMemberRepository.findById(memberId)
                .orElseThrow(() -> new IllegalArgumentException("Member not found"));

        if (!member.getGroup().getId().equals(groupId)) {
            throw new IllegalArgumentException("Member does not belong to this group");
        }
        if (member.getUserId() != null) {
            throw new IllegalStateException("This member profile has already been claimed");
        }

        member.setUserId(userId);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        member.setDisplayName(user.getFullName());

        return mapToMemberResponse(groupMemberRepository.save(member));
    }

    private GroupResponse mapToGroupResponse(TripGroup group) {
        List<MemberResponse> members = groupMemberRepository.findByGroupId(group.getId()).stream()
                .map(this::mapToMemberResponse)
                .collect(Collectors.toList());

        return GroupResponse.builder()
                .id(group.getId())
                .name(group.getName())
                .currencyCode(group.getCurrencyCode())
                .inviteCode(group.getInviteCode())
                .createdBy(group.getCreatedBy())
                .isArchived(group.getIsArchived())
                .members(members)
                .build();
    }

    private MemberResponse mapToMemberResponse(GroupMember member) {
        return MemberResponse.builder()
                .id(member.getId())
                .userId(member.getUserId())
                .displayName(member.getDisplayName())
                .role(member.getRole())
                .joinedAt(member.getJoinedAt())
                .isVirtual(member.getUserId() == null)
                .build();
    }
}
