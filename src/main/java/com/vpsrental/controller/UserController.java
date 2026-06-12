package com.vpsrental.controller;

import com.vpsrental.entity.Transaction;
import com.vpsrental.entity.User;
import com.vpsrental.service.UserService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getProfile(@AuthenticationPrincipal Jwt jwt) {
        User user = userService.getOrCreateUserFromJwt(jwt);
        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("username", user.getUsername());
        profile.put("email", user.getEmail());
        profile.put("balance", user.getBalance());
        profile.put("avatarUrl", user.getAvatarUrl());
        profile.put("cognitoSub", user.getCognitoSub());
        return ResponseEntity.ok(profile);
    }

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadAvatar(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file) throws IOException {
        
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        User user = userService.updateAvatar(jwt, file.getBytes(), file.getContentType(), file.getOriginalFilename());
        return ResponseEntity.ok(Map.of("avatarUrl", user.getAvatarUrl()));
    }

    @GetMapping("/me/transactions")
    public ResponseEntity<List<TransactionResponse>> getTransactions(@AuthenticationPrincipal Jwt jwt) {
        List<Transaction> transactions = userService.getTransactionHistory(jwt);
        List<TransactionResponse> response = transactions.stream()
                .map(t -> new TransactionResponse(t.getId(), t.getAmount(), t.getType(), t.getDescription(), t.getCreatedAt().toString()))
                .toList();
        return ResponseEntity.ok(response);
    }

    // DTO records
    public record TransactionResponse(Long id, BigDecimal amount, String type, String description, String createdAt) {}
}
