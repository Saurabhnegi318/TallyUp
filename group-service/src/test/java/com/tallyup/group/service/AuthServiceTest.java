package com.tallyup.group.service;

import com.tallyup.group.config.JwtUtil;
import com.tallyup.group.dto.AuthDTOs.*;
import com.tallyup.group.entity.User;
import com.tallyup.group.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtUtil jwtUtil;

    @InjectMocks
    private AuthService authService;

    @Test
    @DisplayName("Should successfully register a new user and return JWT")
    void testRegisterSuccess() {
        RegisterRequest req = RegisterRequest.builder()
                .fullName("Saurabh Kumar")
                .email("saurabh@example.com")
                .password("securePassword123")
                .build();

        when(userRepository.existsByEmail("saurabh@example.com")).thenReturn(false);
        when(passwordEncoder.encode(any())).thenReturn("hashed_password");

        UUID userId = UUID.randomUUID();
        User savedUser = User.builder()
                .id(userId)
                .fullName("Saurabh Kumar")
                .email("saurabh@example.com")
                .passwordHash("hashed_password")
                .build();

        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        when(jwtUtil.generateToken(eq(userId), eq("saurabh@example.com"))).thenReturn("mocked.jwt.token");

        AuthResponse res = authService.register(req);

        assertNotNull(res);
        assertEquals(userId, res.getUserId());
        assertEquals("mocked.jwt.token", res.getToken());
        assertEquals("Saurabh Kumar", res.getFullName());
    }

    @Test
    @DisplayName("Registering existing email should throw IllegalArgumentException")
    void testRegisterDuplicateEmail() {
        RegisterRequest req = RegisterRequest.builder()
                .fullName("Saurabh")
                .email("duplicate@example.com")
                .password("pwd12345")
                .build();

        when(userRepository.existsByEmail("duplicate@example.com")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> authService.register(req));
    }
}
