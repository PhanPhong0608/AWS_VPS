package com.vpsrental.controller;

import com.vpsrental.entity.VpsInstance;
import com.vpsrental.service.VpsService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/vps")
public class VpsController {

    private final VpsService vpsService;

    public VpsController(VpsService vpsService) {
        this.vpsService = vpsService;
    }

    @GetMapping
    public ResponseEntity<List<VpsResponse>> getMyVpsList(@AuthenticationPrincipal Jwt jwt) {
        List<VpsInstance> list = vpsService.getMyVpsInstances(jwt);
        List<VpsResponse> response = list.stream()
                .map(this::toResponseDto)
                .toList();
        return ResponseEntity.ok(response);
    }

    @PostMapping("/rent")
    public ResponseEntity<VpsResponse> rentVps(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody RentRequest request) {
        
        VpsInstance vps = vpsService.rentVps(jwt, request.name(), request.instanceType(), request.osType());
        return ResponseEntity.ok(toResponseDto(vps));
    }

    @PostMapping("/{id}/start")
    public ResponseEntity<VpsResponse> startVps(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {
        
        VpsInstance vps = vpsService.startVps(jwt, id);
        return ResponseEntity.ok(toResponseDto(vps));
    }

    @PostMapping("/{id}/stop")
    public ResponseEntity<VpsResponse> stopVps(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {

        VpsInstance vps = vpsService.stopVps(jwt, id);
        return ResponseEntity.ok(toResponseDto(vps));
    }

    @PostMapping("/{id}/reboot")
    public ResponseEntity<VpsResponse> rebootVps(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {

        VpsInstance vps = vpsService.rebootVps(jwt, id);
        return ResponseEntity.ok(toResponseDto(vps));
    }

    @PostMapping("/{id}/sync")
    public ResponseEntity<VpsResponse> syncVps(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable Long id) {

        VpsInstance vps = vpsService.syncVpsStatus(jwt, id);
        return ResponseEntity.ok(toResponseDto(vps));
    }

    private VpsResponse toResponseDto(VpsInstance vps) {
        return new VpsResponse(
                vps.getId(),
                vps.getInstanceId(),
                vps.getName(),
                vps.getInstanceType(),
                vps.getOsType(),
                vps.getPublicIp(),
                vps.getStatus(),
                vps.getMonthlyPrice(),
                vps.getExpiryDate().toString(),
                vps.getCreatedAt().toString()
        );
    }

    // DTO records
    public record RentRequest(
            @NotBlank(message = "VPS name is required")
            String name,

            @NotBlank(message = "Instance type is required")
            @Pattern(regexp = "^(t2\\.micro|t3\\.micro|t3\\.medium)$", message = "Invalid instance type. Choose t2.micro, t3.micro, or t3.medium")
            String instanceType,

            @NotBlank(message = "OS type is required")
            @Pattern(regexp = "^(UBUNTU|AMAZON_LINUX|WINDOWS)$", message = "Invalid OS. Choose UBUNTU, AMAZON_LINUX, or WINDOWS")
            String osType
    ) {}

    public record VpsResponse(
            Long id,
            String instanceId,
            String name,
            String instanceType,
            String osType,
            String publicIp,
            String status,
            BigDecimal monthlyPrice,
            String expiryDate,
            String createdAt
    ) {}
}
