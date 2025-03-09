// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubscriptionService {
    struct Subscription {
        uint256 price;
        uint256 duration;
    }

    struct UserSubscription {
        uint256 expiry;
        string level;
    }

    IERC20 public usdc;
    mapping(address => mapping(string => Subscription)) public subscriptions;
    mapping(address => mapping(address => UserSubscription))
        public userSubscriptions;
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => bool)) public autoRenewal;
    mapping(address => mapping(address => bool)) public hasUsedTrial;

    event SubscriptionCreated(
        address indexed creator,
        string level,
        uint256 price,
        uint256 duration
    );
    event Subscribed(
        address indexed user,
        address indexed creator,
        string level,
        uint256 expiry
    );
    event Withdrawn(address indexed creator, uint256 amount);
    event SubscriptionCanceled(address indexed user, address indexed creator);
    event TrialStarted(
        address indexed user,
        address indexed creator,
        uint256 expiry
    );

    constructor(address _usdc) {
        usdc = IERC20(_usdc);
    }

    /// @notice Creates a new subscription level
    function createSubscription(
        string memory level,
        uint256 price,
        uint256 duration
    ) external {
        require(price > 0, "Price must be greater than zero");
        require(duration > 0, "Duration must be greater than zero");

        subscriptions[msg.sender][level] = Subscription({
            price: price,
            duration: duration
        });

        emit SubscriptionCreated(msg.sender, level, price, duration);
    }

    /// @notice Subscribe to a creator's plan
    function subscribe(address creator, string memory level) external {
        Subscription storage sub = subscriptions[creator][level];
        require(sub.price > 0, "Subscription does not exist");
        require(
            usdc.transferFrom(msg.sender, address(this), sub.price),
            "Payment failed"
        );

        userSubscriptions[msg.sender][creator] = UserSubscription({
            expiry: block.timestamp + sub.duration,
            level: level
        });

        balances[creator] += sub.price;

        emit Subscribed(
            msg.sender,
            creator,
            level,
            userSubscriptions[msg.sender][creator].expiry
        );
    }

    /// @notice Enables automatic subscription renewal
    function enableAutoRenew(address creator) external {
        require(
            userSubscriptions[msg.sender][creator].expiry > block.timestamp,
            "Subscription inactive"
        );
        autoRenewal[msg.sender][creator] = true;
    }

    function disableAutoRenew(address creator) external {
        autoRenewal[msg.sender][creator] = false;
    }

    function renewSubscription(address user, address creator) external {
        require(autoRenewal[user][creator], "Auto-renewal not enabled");

        UserSubscription storage sub = userSubscriptions[user][creator];
        Subscription storage plan = subscriptions[creator][sub.level];

        require(plan.price > 0, "Subscription does not exist");
        require(
            usdc.transferFrom(user, address(this), plan.price),
            "Payment failed"
        );

        sub.expiry += plan.duration;
    }

    /// @notice Allows creators to withdraw their earnings
    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "No funds to withdraw");
        balances[msg.sender] = 0;
        require(usdc.transfer(msg.sender, balance), "Withdrawal failed");
        emit Withdrawn(msg.sender, balance);
    }

    /// @notice Allows users to cancel their subscription
    function cancelSubscription(address creator) external {
        require(
            userSubscriptions[msg.sender][creator].expiry > block.timestamp,
            "Subscription not active"
        );
        userSubscriptions[msg.sender][creator].expiry = block.timestamp;
        emit SubscriptionCanceled(msg.sender, creator);
    }

    /// @notice Checks if a user has an active subscription
    function isSubscribed(
        address user,
        address creator
    ) external view returns (bool) {
        return block.timestamp < userSubscriptions[user][creator].expiry;
    }

    /// @notice Returns the remaining time for a user's subscription
    function getRemainingTime(
        address user,
        address creator
    ) external view returns (uint256) {
        if (block.timestamp >= userSubscriptions[user][creator].expiry) {
            return 0;
        }
        return userSubscriptions[user][creator].expiry - block.timestamp;
    }

    /// @notice Starts a free trial for a user
    function startTrial(address creator, uint256 trialDuration) external {
        require(!hasUsedTrial[msg.sender][creator], "Trial already used");
        userSubscriptions[msg.sender][creator] = UserSubscription({
            expiry: block.timestamp + trialDuration,
            level: "trial"
        });
        hasUsedTrial[msg.sender][creator] = true;
        emit TrialStarted(
            msg.sender,
            creator,
            userSubscriptions[msg.sender][creator].expiry
        );
    }
}
