package com.vpsrental.controller;

import com.vpsrental.entity.User;
import com.vpsrental.service.UserService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private final UserService userService;

    public PaymentController(UserService userService) {
        this.userService = userService;
    }

    @PostMapping("/deposit")
    public ResponseEntity<Map<String, Object>> deposit(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody DepositRequest request) {
        
        User updatedUser = userService.depositMoney(jwt, request.amount(), request.description());
        return ResponseEntity.ok(Map.of(
                "message", "Deposit simulated successfully",
                "newBalance", updatedUser.getBalance()
        ));
    }

    public record DepositRequest(
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "0.01", message = "Amount must be greater than zero")
            BigDecimal amount,

            String description
    ) {}
}
