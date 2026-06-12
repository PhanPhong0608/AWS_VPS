package com.vpsrental.service;

import com.vpsrental.entity.Transaction;
import com.vpsrental.entity.User;
import com.vpsrental.entity.VpsInstance;
import com.vpsrental.repository.TransactionRepository;
import com.vpsrental.repository.UserRepository;
import com.vpsrental.repository.VpsInstanceRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.services.ec2.Ec2Client;
import software.amazon.awssdk.services.ec2.model.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class VpsService {

    private final Ec2Client ec2Client;
    private final VpsInstanceRepository vpsInstanceRepository;
    private final UserRepository userRepository;
    private final TransactionRepository transactionRepository;
    private final UserService userService;

    // Standard monthly prices
    private static final Map<String, BigDecimal> PRICING = Map.of(
            "t2.micro", new BigDecimal("5.00"),
            "t3.micro", new BigDecimal("8.00"),
            "t3.medium", new BigDecimal("20.00")
    );

    // standard AMIs for ap-southeast-1 (Singapore). In a real setting, these would be in configs.
    private static final Map<String, String> OS_AMIS = Map.of(
            "UBUNTU", "ami-053b0d53c279acc90",
            "AMAZON_LINUX", "ami-0c20b8dc018ff94d4",
            "WINDOWS", "ami-0d2d38561d36fb083"
    );

    public VpsService(Ec2Client ec2Client,
                      VpsInstanceRepository vpsInstanceRepository,
                      UserRepository userRepository,
                      TransactionRepository transactionRepository,
                      UserService userService) {
        this.ec2Client = ec2Client;
        this.vpsInstanceRepository = vpsInstanceRepository;
        this.userRepository = userRepository;
        this.transactionRepository = transactionRepository;
        this.userService = userService;
    }

    public List<VpsInstance> getMyVpsInstances(Jwt jwt) {
        User owner = userService.getOrCreateUserFromJwt(jwt);
        return vpsInstanceRepository.findByOwner(owner);
    }

    @Transactional
    public VpsInstance rentVps(Jwt jwt, String name, String instanceType, String osType) {
        User user = userService.getOrCreateUserFromJwt(jwt);

        // 1. Calculate and validate pricing
        BigDecimal price = PRICING.getOrDefault(instanceType, new BigDecimal("10.00"));
        if (user.getBalance().compareTo(price) < 0) {
            throw new IllegalArgumentException("Insufficient wallet balance. Price: $" + price + ", Wallet: $" + user.getBalance());
        }

        String amiId = OS_AMIS.getOrDefault(osType.toUpperCase(), "ami-053b0d53c279acc90");

        // 2. Deduct balance & create transaction
        user.setBalance(user.getBalance().subtract(price));
        userRepository.save(user);

        Transaction transaction = Transaction.builder()
                .user(user)
                .amount(price.negate())
                .type("RENT")
                .description("VPS Rental: " + name + " (" + instanceType + ")")
                .build();
        transactionRepository.save(transaction);

        // 3. Create VPS Entity (Temporary status while provisioning)
        VpsInstance vpsInstance = VpsInstance.builder()
                .name(name)
                .owner(user)
                .instanceType(instanceType)
                .osType(osType.toUpperCase())
                .amiId(amiId)
                .status("PENDING")
                .monthlyPrice(price)
                .expiryDate(LocalDateTime.now().plusMonths(1))
                .build();
        
        vpsInstance = vpsInstanceRepository.save(vpsInstance);

        // 4. Launch Amazon EC2 Instance
        try {
            RunInstancesRequest runRequest = RunInstancesRequest.builder()
                    .imageId(amiId)
                    .instanceType(InstanceType.fromValue(instanceType))
                    .minCount(1)
                    .maxCount(1)
                    .tagSpecifications(TagSpecification.builder()
                            .resourceType(ResourceType.INSTANCE)
                            .tags(Tag.builder().key("Name").value(name).build(),
                                  Tag.builder().key("OwnerSub").value(user.getCognitoSub()).build())
                            .build())
                    .build();

            RunInstancesResponse runResponse = ec2Client.runInstances(runRequest);
            String ec2InstanceId = runResponse.instances().get(0).instanceId();
            
            vpsInstance.setInstanceId(ec2InstanceId);
            vpsInstance.setStatus("RUNNING");
            vpsInstance = vpsInstanceRepository.save(vpsInstance);

        } catch (Exception e) {
            // Rollback billing transaction locally if AWS EC2 launch fails
            user.setBalance(user.getBalance().add(price));
            userRepository.save(user);
            
            transactionRepository.delete(transaction);
            vpsInstanceRepository.delete(vpsInstance);
            
            throw new RuntimeException("AWS EC2 instance provisioning failed: " + e.getMessage(), e);
        }

        return vpsInstance;
    }

    public VpsInstance getVpsAndVerifyOwner(Jwt jwt, Long id) {
        User user = userService.getOrCreateUserFromJwt(jwt);
        VpsInstance vps = vpsInstanceRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("VPS instance not found"));

        if (!vps.getOwner().getId().equals(user.getId())) {
            throw new SecurityException("Unauthorized access to this VPS instance");
        }
        return vps;
    }

    public VpsInstance startVps(Jwt jwt, Long id) {
        VpsInstance vps = getVpsAndVerifyOwner(jwt, id);
        
        StartInstancesRequest request = StartInstancesRequest.builder()
                .instanceIds(vps.getInstanceId())
                .build();
        
        ec2Client.startInstances(request);
        vps.setStatus("RUNNING");
        return vpsInstanceRepository.save(vps);
    }

    public VpsInstance stopVps(Jwt jwt, Long id) {
        VpsInstance vps = getVpsAndVerifyOwner(jwt, id);

        StopInstancesRequest request = StopInstancesRequest.builder()
                .instanceIds(vps.getInstanceId())
                .build();

        ec2Client.stopInstances(request);
        vps.setStatus("STOPPED");
        return vpsInstanceRepository.save(vps);
    }

    public VpsInstance rebootVps(Jwt jwt, Long id) {
        VpsInstance vps = getVpsAndVerifyOwner(jwt, id);

        RebootInstancesRequest request = RebootInstancesRequest.builder()
                .instanceIds(vps.getInstanceId())
                .build();

        ec2Client.rebootInstances(request);
        vps.setStatus("RUNNING");
        return vpsInstanceRepository.save(vps);
    }

    public VpsInstance syncVpsStatus(Jwt jwt, Long id) {
        VpsInstance vps = getVpsAndVerifyOwner(jwt, id);
        if (vps.getInstanceId() == null) {
            return vps;
        }

        try {
            DescribeInstancesRequest request = DescribeInstancesRequest.builder()
                    .instanceIds(vps.getInstanceId())
                    .build();
            
            DescribeInstancesResponse response = ec2Client.describeInstances(request);
            Instance instance = response.reservations().get(0).instances().get(0);
            
            String awsState = instance.state().name().toString().toUpperCase(); // running, stopped, pending, shutting-down, terminated, stopping
            vps.setStatus(awsState);
            vps.setPublicIp(instance.publicIpAddress());
            
            return vpsInstanceRepository.save(vps);
        } catch (Exception e) {
            throw new RuntimeException("Failed to synchronize VPS status with AWS EC2: " + e.getMessage(), e);
        }
    }
}
