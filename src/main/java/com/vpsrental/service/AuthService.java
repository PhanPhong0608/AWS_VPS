package com.vpsrental.service;

import com.vpsrental.entity.User;
import com.vpsrental.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.cognitoidentityprovider.CognitoIdentityProviderClient;
import software.amazon.awssdk.services.cognitoidentityprovider.model.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class AuthService {

    private final CognitoIdentityProviderClient cognitoClient;
    private final UserRepository userRepository;

    @Value("${aws.cognito.client-id}")
    private String clientId;

    @Value("${aws.cognito.client-secret:}")
    private String clientSecret;

    public AuthService(CognitoIdentityProviderClient cognitoClient, UserRepository userRepository) {
        this.cognitoClient = cognitoClient;
        this.userRepository = userRepository;
    }

    @Transactional
    public String registerUser(String username, String email, String password) {
        // 1. Call AWS Cognito Sign Up
        SignUpRequest.Builder signUpRequestBuilder = SignUpRequest.builder()
                .clientId(clientId)
                .username(username)
                .password(password)
                .userAttributes(
                        AttributeType.builder().name("email").value(email).build()
                );

        String secretHash = calculateSecretHash(username);
        if (secretHash != null) {
            signUpRequestBuilder.secretHash(secretHash);
        }

        SignUpResponse signUpResponse = cognitoClient.signUp(signUpRequestBuilder.build());
        String cognitoSub = signUpResponse.userSub();

        // 2. Save User to RDS local database
        User newUser = User.builder()
                .username(username)
                .email(email)
                .cognitoSub(cognitoSub)
                .balance(BigDecimal.ZERO)
                .build();
        userRepository.save(newUser);

        return "User registered successfully. Please check your email for the confirmation code.";
    }

    public void confirmUser(String username, String code) {
        ConfirmSignUpRequest.Builder confirmBuilder = ConfirmSignUpRequest.builder()
                .clientId(clientId)
                .username(username)
                .confirmationCode(code);

        String secretHash = calculateSecretHash(username);
        if (secretHash != null) {
            confirmBuilder.secretHash(secretHash);
        }

        cognitoClient.confirmSignUp(confirmBuilder.build());
    }

    public Map<String, Object> loginUser(String username, String password) {
        Map<String, String> authParams = new HashMap<>();
        authParams.put("USERNAME", username);
        authParams.put("PASSWORD", password);

        String secretHash = calculateSecretHash(username);
        if (secretHash != null) {
            authParams.put("SECRET_HASH", secretHash);
        }

        InitiateAuthRequest authRequest = InitiateAuthRequest.builder()
                .authFlow(AuthFlowType.USER_PASSWORD_AUTH)
                .clientId(clientId)
                .authParameters(authParams)
                .build();

        InitiateAuthResponse authResponse = cognitoClient.initiateAuth(authRequest);
        AuthenticationResultType authResult = authResponse.authenticationResult();

        Map<String, Object> tokens = new HashMap<>();
        tokens.put("accessToken", authResult.accessToken());
        tokens.put("idToken", authResult.idToken());
        tokens.put("refreshToken", authResult.refreshToken());
        tokens.put("expiresIn", authResult.expiresIn());
        tokens.put("tokenType", authResult.tokenType());

        return tokens;
    }

    private String calculateSecretHash(String username) {
        if (clientSecret == null || clientSecret.trim().isEmpty()) {
            return null;
        }
        String message = username + clientId;
        try {
            Mac sha256HMAC = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(clientSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            sha256HMAC.init(secretKeySpec);
            byte[] rawHmac = sha256HMAC.doFinal(message.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(rawHmac);
        } catch (Exception e) {
            throw new RuntimeException("Error calculating Cognito Secret Hash", e);
        }
    }
}
