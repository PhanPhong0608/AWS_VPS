package com.vpsrental.service;

import com.vpsrental.entity.Transaction;
import com.vpsrental.entity.User;
import com.vpsrental.repository.TransactionRepository;
import com.vpsrental.repository.UserRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final S3Service s3Service;

    public UserService(UserRepository userRepository, 
                       TransactionRepository transactionRepository, 
                       S3Service s3Service) {
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.s3Service = s3Service;
    }

    public User getOrCreateUserFromJwt(Jwt jwt) {
        String cognitoSub = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        String username = jwt.getClaimAsString("cognito:username");
        if (username == null) {
            username = jwt.getClaimAsString("username");
        }
        if (username == null) {
            username = email != null ? email.split("@")[0] : "user_" + cognitoSub.substring(0, 8);
        }

        final String finalUsername = username;
        return userRepository.findByCognitoSub(cognitoSub)
                .orElseGet(() -> {
                    User user = User.builder()
                            .cognitoSub(cognitoSub)
                            .username(finalUsername)
                            .email(email != null ? email : finalUsername + "@example.com")
                            .balance(BigDecimal.ZERO)
                            .build();
                    return userRepository.save(user);
                });
    }

    @Transactional
    public User depositMoney(Jwt jwt, BigDecimal amount, String description) {
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("Deposit amount must be positive");
        }

        User user = getOrCreateUserFromJwt(jwt);
        user.setBalance(user.getBalance().add(amount));
        userRepository.save(user);

        // Record the transaction
        Transaction transaction = Transaction.builder()
                .user(user)
                .amount(amount)
                .type("DEPOSIT")
                .description(description != null ? description : "Wallet Deposit")
                .build();
        transactionRepository.save(transaction);

        return user;
    }

    @Transactional
    public User updateAvatar(Jwt jwt, byte[] imageData, String contentType, String filename) {
        User user = getOrCreateUserFromJwt(jwt);
        
        // Construct unique key
        String key = "avatars/" + user.getCognitoSub() + "/" + System.currentTimeMillis() + "_" + filename;
        String avatarUrl = s3Service.uploadFile(key, imageData, contentType);
        
        user.setAvatarUrl(avatarUrl);
        return userRepository.save(user);
    }

    public List<Transaction> getTransactionHistory(Jwt jwt) {
        User user = getOrCreateUserFromJwt(jwt);
        return transactionRepository.findByUserOrderByCreatedAtDesc(user);
    }
}
