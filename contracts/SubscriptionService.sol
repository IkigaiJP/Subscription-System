// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SubscriptionService {
    struct SubscriptionPlan {
        address creator;
        string name;
        uint256 price;
        uint256 duration; // in days
    }

    struct UserSubscription {
        uint256 expiry;
        bool autoRenewal;
        bool hasUsedTrial;
    }

    IERC20 public immutable usdc;
    uint256 private subscriptionCounter;

    // planId -> SubscriptionPlan
    mapping(uint256 => SubscriptionPlan) public subscriptionPlans;

    // creator -> created plan IDs
    mapping(address => uint256[]) private subscriptionsByCreator;

    // user -> planId -> UserSubscription
    mapping(address => mapping(uint256 => UserSubscription))
        public userSubscriptions;

    // user -> array of all planIds ever subscribed to
    mapping(address => uint256[]) private userPlanIds;

    // creator -> balance
    mapping(address => uint256) private creatorBalances;

    event SubscriptionCreated(
        address indexed creator,
        uint256 indexed planId,
        string name,
        uint256 price,
        uint256 duration
    );
    event Subscribed(
        address indexed user,
        uint256 indexed planId,
        uint256 expiry
    );
    event Withdrawn(address indexed creator, uint256 amount);
    event SubscriptionCanceled(address indexed user, uint256 indexed planId);
    event TrialStarted(
        address indexed user,
        uint256 indexed planId,
        uint256 expiry
    );
    event AutoRenewalUpdated(
        address indexed user,
        uint256 indexed planId,
        bool enabled
    );

    constructor(address _usdc) {
        require(_usdc != address(0), "Invalid USDC address");
        usdc = IERC20(_usdc);
    }

    function createSubscriptionPlan(
        string calldata name,
        uint256 price,
        uint256 duration
    ) external {
        require(bytes(name).length > 0, "Name required");
        require(price > 0, "Price > 0");
        require(duration > 0, "Duration > 0");

        uint256 newId = ++subscriptionCounter;
        subscriptionPlans[newId] = SubscriptionPlan({
            creator: msg.sender,
            name: name,
            price: price,
            duration: duration
        });

        subscriptionsByCreator[msg.sender].push(newId);

        emit SubscriptionCreated(msg.sender, newId, name, price, duration);
    }

    function subscribeToPlan(uint256 planId) external {
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        require(plan.price > 0, "Plan does not exist");

        require(
            usdc.transferFrom(msg.sender, address(this), plan.price),
            "Payment failed"
        );
        creatorBalances[plan.creator] += plan.price;

        UserSubscription storage userSub = userSubscriptions[msg.sender][
            planId
        ];
        // If expiry == 0, it means there has never been a subscription before
        bool isFirstTime = (userSub.expiry == 0);

        // Extending the subscription
        userSub.expiry = block.timestamp + (plan.duration * 1 days);
        userSub.autoRenewal = false;

        // Push planId only if subscribing for the first time
        if (isFirstTime) {
            userPlanIds[msg.sender].push(planId);
        }

        emit Subscribed(msg.sender, planId, userSub.expiry);
    }

    function enableAutoRenewal(uint256 planId) external {
        UserSubscription storage userSub = userSubscriptions[msg.sender][
            planId
        ];
        require(userSub.expiry > block.timestamp, "Inactive subscription");

        userSub.autoRenewal = true;
        emit AutoRenewalUpdated(msg.sender, planId, true);
    }

    function disableAutoRenewal(uint256 planId) external {
        UserSubscription storage userSub = userSubscriptions[msg.sender][
            planId
        ];
        userSub.autoRenewal = false;
        emit AutoRenewalUpdated(msg.sender, planId, false);
    }

    function renewUserSubscription(uint256 planId) external {
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        require(plan.price > 0, "Plan does not exist");

        UserSubscription storage userSub = userSubscriptions[msg.sender][
            planId
        ];
        require(userSub.autoRenewal, "Auto-renewal off");
        require(block.timestamp >= userSub.expiry, "Not expired");

        require(
            usdc.transferFrom(msg.sender, address(this), plan.price),
            "Payment failed"
        );
        creatorBalances[plan.creator] += plan.price;

        userSub.expiry = block.timestamp + (plan.duration * 1 days);
    }

    function cancelUserSubscription(uint256 planId) external {
        SubscriptionPlan storage plan = subscriptionPlans[planId];
        require(plan.price > 0, "Plan does not exist");

        UserSubscription storage userSub = userSubscriptions[msg.sender][
            planId
        ];
        require(block.timestamp < userSub.expiry, "Already expired");

        uint256 remainingTime = userSub.expiry - block.timestamp;
        uint256 totalTime = plan.duration * 1 days;
        uint256 refundAmount = (remainingTime * plan.price) / totalTime;

        userSub.expiry = block.timestamp;

        if (refundAmount > 0 && creatorBalances[plan.creator] >= refundAmount) {
            creatorBalances[plan.creator] -= refundAmount;
            require(usdc.transfer(msg.sender, refundAmount), "Refund failed");
        }

        emit SubscriptionCanceled(msg.sender, planId);
    }

    function withdrawEarnings() external {
        uint256 balance = creatorBalances[msg.sender];
        require(balance > 0, "No funds");

        creatorBalances[msg.sender] = 0;
        require(usdc.transfer(msg.sender, balance), "Withdraw failed");

        emit Withdrawn(msg.sender, balance);
    }

    function getCreatorBalance(
        address creator
    ) external view returns (uint256) {
        return creatorBalances[creator];
    }

    function hasActiveSubscription(
        address user,
        uint256 planId
    ) public view returns (bool) {
        return userSubscriptions[user][planId].expiry > block.timestamp;
    }

    function getCreatorSubscriptions(
        address user
    ) external view returns (uint256[] memory) {
        return subscriptionsByCreator[user];
    }

    function getAllSubscriptionPlans()
        external
        view
        returns (SubscriptionPlan[] memory)
    {
        SubscriptionPlan[] memory allPlans = new SubscriptionPlan[](
            subscriptionCounter
        );
        for (uint256 i = 1; i <= subscriptionCounter; i++) {
            allPlans[i - 1] = subscriptionPlans[i];
        }
        return allPlans;
    }

    // Returns all plan IDs user has ever subscribed to (including expired)
    function getUserSubscribedPlans(
        address user
    ) external view returns (uint256[] memory) {
        return userPlanIds[user];
    }

    function getUserSubscription(
        address user,
        uint256 planId
    ) external view returns (UserSubscription memory) {
        return userSubscriptions[user][planId];
    }
}
