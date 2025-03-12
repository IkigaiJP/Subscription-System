import React, { useState, useEffect } from "react";
import {
  BrowserProvider,
  Contract,
  parseUnits,
  formatUnits
} from "ethers";

// ABIs
import subscriptionServiceABI from "../abi/SubscriptionService.json";
import testUSDCABI from "../abi/TestUSDC.json";
import erc20ABI from "../abi/ERC20.json";

// CSS
import "../styles/SubscriptionList.css";
import "../styles/ConnectWallet.css";

/* 
  ===========================================
    1) HELPER FUNCTIONS TO FETCH BALANCES
  ===========================================
*/

/**
 * Fetch the USDC (or Test USDC) balance for a given wallet address.
 * @param {string} address - User's wallet address.
 * @param {string} usdcAddress - USDC contract address.
 * @returns {string} The formatted balance.
 */
async function fetchUSDCBalance(address, usdcAddress) {
  if (!address) return "0";
  try {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(usdcAddress, testUSDCABI, provider);

    const decimals = await contract.decimals();
    const rawBalance = await contract.balanceOf(address);

    return formatUnits(rawBalance, decimals);
  } catch (err) {
    console.error("fetchUSDCBalance error:", err);
    return "0";
  }
}

/**
 * Fetch the creator's earnings stored in the SubscriptionService contract.
 * @param {string} address - User's wallet address.
 * @param {string} subscriptionContractAddr - SubscriptionService contract address.
 * @returns {string} The formatted earnings.
 */
async function fetchCreatorEarnings(address, subscriptionContractAddr) {
  if (!address) return "0";
  try {
    const provider = new BrowserProvider(window.ethereum);
    const contract = new Contract(subscriptionContractAddr, subscriptionServiceABI, provider);

    const rawEarnings = await contract.getCreatorBalance(address);
    // Typically USDC has 6 decimals
    return formatUnits(rawEarnings, 6);
  } catch (err) {
    console.error("fetchCreatorEarnings error:", err);
    return "0";
  }
}

/* 
  ===========================================
    2) CONNECTWALLET COMPONENT
  ===========================================
*/

/**
 * ConnectWallet allows users to connect their MetaMask wallet, 
 * claim test USDC, and withdraw creator earnings.
 */
function ConnectWallet({
  walletAddress,
  setWalletAddress,
  usdcBalance,
  setUsdcBalance,
  platformEarnings,
  setPlatformEarnings
}) {
  const testUsdcAddress = process.env.REACT_APP_USDC_CONTRACT_ADDRESS;
  const subscriptionContractAddr = process.env.REACT_APP_SUBSCRIPTION_CONTRACT_ADDRESS;

  /**
   * Requests MetaMask to connect and sets the first account to state.
   */
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("MetaMask is not installed. Please install it to proceed.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });
      const userAddress = accounts[0];
      console.log("Connected Wallet Address:", userAddress);
      setWalletAddress(userAddress);
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
    }
  };

  /**
   * Allows the user to claim 1000 test USDC via a faucet function.
   */
  const handleGetTestUSDC = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const testUsdcContract = new Contract(testUsdcAddress, testUSDCABI, signer);
      const tx = await testUsdcContract.faucet(); // Claims test USDC
      await tx.wait();

      alert("You have successfully claimed 1000 Test USDC!");
      // Refresh the USDC balance
      const updatedBalance = await fetchUSDCBalance(walletAddress, testUsdcAddress);
      setUsdcBalance(updatedBalance);
    } catch (error) {
      console.error("Error claiming Test USDC:", error);
      alert("An error occurred while claiming test USDC.");
    }
  };

  /**
   * Withdraws the creator's earnings from the SubscriptionService contract.
   */
  const handleWithdrawEarnings = async () => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const subContract = new Contract(subscriptionContractAddr, subscriptionServiceABI, signer);

      const tx = await subContract.withdrawEarnings();
      await tx.wait();

      alert("You have successfully withdrawn your platform earnings!");
      // Update both wallet balance and platform earnings
      const updatedBalance = await fetchUSDCBalance(walletAddress, testUsdcAddress);
      setUsdcBalance(updatedBalance);

      const updatedEarnings = await fetchCreatorEarnings(walletAddress, subscriptionContractAddr);
      setPlatformEarnings(updatedEarnings);
    } catch (error) {
      console.error("Error withdrawing earnings:", error);
      alert("Failed to withdraw earnings. Check the console for details.");
    }
  };

  /**
   * Utility to truncate a wallet address for cleaner display.
   */
  const truncateAddress = (address) =>
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="top-right">
      {!walletAddress ? (
        <button className="button" onClick={connectWallet}>
          Connect MetaMask
        </button>
      ) : (
        <div>
          <p className="wallet-address">{truncateAddress(walletAddress)}</p>

          {usdcBalance && (
            <p className="wallet-balance">
              {usdcBalance} USDC (in your wallet)
            </p>
          )}

          {platformEarnings && (
            <p className="wallet-balance">
              {platformEarnings} USDC (on platform)
            </p>
          )}

          <button className="button" onClick={handleGetTestUSDC}>
            Get 1000 Test USDC
          </button>

          {Number(platformEarnings) > 0 && (
            <button
              className="button"
              style={{ marginLeft: "8px" }}
              onClick={handleWithdrawEarnings}
            >
              Withdraw Earnings
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* 
  ===========================================
    3) SUBSCRIPTIONLIST COMPONENT
  ===========================================
*/

/**
 * SubscriptionList provides:
 *  - A list of all subscription plans.
 *  - Plans created by the user.
 *  - Plans the user is subscribed to.
 * Allows creating new plans, subscribing, and managing subscriptions.
 */
function SubscriptionList({
  walletAddress,
  usdcBalance,
  platformEarnings,
  updateAllBalances
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [allPlans, setAllPlans] = useState([]);
  const [createdPlans, setCreatedPlans] = useState([]);
  const [subscribedPlans, setSubscribedPlans] = useState([]);

  const [isLoading, setIsLoading] = useState(false);

  const [newPlan, setNewPlan] = useState({ name: "", price: "", duration: "" });
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contractAddress = process.env.REACT_APP_SUBSCRIPTION_CONTRACT_ADDRESS;
  const usdcAddress = process.env.REACT_APP_USDC_CONTRACT_ADDRESS;

  /**
   * Formats a UNIX timestamp (in seconds) to a readable date-time string.
   */
  const formatDate = (timestampInSeconds) => {
    if (!timestampInSeconds) return "";
    const dateObj = new Date(timestampInSeconds * 1000);
    return dateObj.toLocaleString();
  };

  /**
   * Fetches all subscription plans from the smart contract.
   */
  const fetchAllPlans = async (userAddress) => {
    setIsLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(contractAddress, subscriptionServiceABI, provider);

      const plans = await contract.getAllSubscriptionPlans();
      const detailedPlans = [];

      for (let i = 0; i < plans.length; i++) {
        const planId = i + 1; // Plans typically start at ID 1
        const planData = plans[i];

        const rawPriceBN = planData.price;
        const displayPrice = formatUnits(rawPriceBN, 6);

        let expiry = 0;
        let isActive = false;

        // If the user is connected, check subscription status
        if (userAddress) {
          const userSub = await contract.getUserSubscription(userAddress, planId);
          expiry = Number(userSub.expiry);
          isActive = expiry > Date.now() / 1000;
        }

        detailedPlans.push({
          planId,
          creator: planData.creator,
          name: planData.name,
          rawPrice: rawPriceBN,
          displayPrice,
          duration: Number(planData.duration),
          userSubExpiry: expiry,
          userSubActive: isActive
        });
      }

      setAllPlans(detailedPlans);
    } catch (error) {
      console.error("Error fetching all plans:", error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Fetches the plans created by the currently connected user.
   */
  const fetchCreatedPlans = async (userAddress) => {
    if (!userAddress) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(contractAddress, subscriptionServiceABI, provider);

      const planIds = await contract.getCreatorSubscriptions(userAddress);
      const promises = planIds.map(async (id) => {
        const planData = await contract.subscriptionPlans(id);
        const rawPriceBN = planData.price;
        const displayPrice = formatUnits(rawPriceBN, 6);

        return {
          planId: Number(id),
          creator: planData.creator,
          name: planData.name,
          rawPrice: rawPriceBN,
          displayPrice,
          duration: Number(planData.duration)
        };
      });

      const results = await Promise.all(promises);
      setCreatedPlans(results);
    } catch (error) {
      console.error("Error fetching created plans:", error);
    }
  };

  /**
   * Fetches the plans to which the user is subscribed.
   */
  const fetchSubscribedPlans = async (userAddress) => {
    if (!userAddress) return;
    try {
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(contractAddress, subscriptionServiceABI, provider);

      const planIds = await contract.getUserSubscribedPlans(userAddress);

      const promises = planIds.map(async (id) => {
        const planData = await contract.subscriptionPlans(id);
        const userSub = await contract.getUserSubscription(userAddress, id);

        const expiry = Number(userSub.expiry);
        const isActive = expiry > Date.now() / 1000;
        const autoRenew = userSub.autoRenewal;

        const rawPriceBN = planData.price;
        const displayPrice = formatUnits(rawPriceBN, 6);

        return {
          planId: Number(id),
          creator: planData.creator,
          name: planData.name,
          rawPrice: rawPriceBN,
          displayPrice,
          duration: Number(planData.duration),
          userSubExpiry: expiry,
          userSubActive: isActive,
          userSubAutoRenew: autoRenew
        };
      });

      const results = await Promise.all(promises);
      setSubscribedPlans(results);
    } catch (error) {
      console.error("Error fetching subscribed plans:", error);
    }
  };

  /**
   * Creates a new subscription plan
   */
  const createSubscriptionPlan = async () => {
    const { name, price, duration } = newPlan;
    if (!name || !price || !duration) {
      alert("All fields are required to create a plan!");
      return;
    }
    try {
      setIsSubmitting(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddress, subscriptionServiceABI, signer);

      // Scale the price for USDC (6 decimals)
      const scaledPriceBN = parseUnits(price, 6);

      const tx = await contract.createSubscriptionPlan(name, scaledPriceBN, duration);
      await tx.wait();

      // Refresh the data
      await fetchAllPlans(walletAddress);
      await fetchCreatedPlans(walletAddress);

      setNewPlan({ name: "", price: "", duration: "" });
      setIsCreating(false);
    } catch (error) {
      console.error("Error creating subscription plan:", error);
      alert("An error occurred while creating the plan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Subscribes the user to a specific plan.
   */
  const handleSubscribe = async (planId, rawPriceBN) => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      setIsSubmitting(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Approve the USDC amount first
      const usdcContract = new Contract(usdcAddress, erc20ABI, signer);
      await usdcContract.approve(contractAddress, rawPriceBN).then((tx) => tx.wait());

      // Now subscribe
      const subscriptionContract = new Contract(contractAddress, subscriptionServiceABI, signer);
      await subscriptionContract.subscribeToPlan(planId).then((tx) => tx.wait());

      // Refresh data
      await fetchAllPlans(walletAddress);
      await fetchSubscribedPlans(walletAddress);

      // Refresh balances
      updateAllBalances();
    } catch (error) {
      console.error(`Error subscribing to plan ${planId}:`, error);
      alert("An error occurred while subscribing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Enables or disables auto-renewal for a user's subscription.
   */
  const handleToggleAutoRenew = async (planId, enable) => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      setIsSubmitting(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddress, subscriptionServiceABI, signer);

      if (enable) {
        await contract.enableAutoRenewal(planId).then((tx) => tx.wait());
      } else {
        await contract.disableAutoRenewal(planId).then((tx) => tx.wait());
      }

      // Refresh the subscription data
      await fetchSubscribedPlans(walletAddress);
    } catch (error) {
      console.error(`Error toggling auto-renew for plan ${planId}:`, error);
      alert("Failed to toggle auto-renew. Check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Manually renew a subscription (if it has expired, for example).
   */
  const handleManualRenew = async (planId, rawPriceBN) => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      setIsSubmitting(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      // Approve the USDC amount
      const usdcContract = new Contract(usdcAddress, erc20ABI, signer);
      await usdcContract.approve(contractAddress, rawPriceBN).then((tx) => tx.wait());

      // Renew the subscription
      const subscriptionContract = new Contract(contractAddress, subscriptionServiceABI, signer);
      await subscriptionContract.renewUserSubscription(planId).then((tx) => tx.wait());

      // Refresh data
      await fetchSubscribedPlans(walletAddress);
      await fetchAllPlans(walletAddress);

      // Refresh balances
      updateAllBalances();
    } catch (error) {
      console.error(`Error renewing subscription for plan ${planId}:`, error);
      alert("Failed to renew subscription. Check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Cancels the user's subscription to a plan.
   */
  const handleCancelSubscription = async (planId) => {
    if (!walletAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    try {
      setIsSubmitting(true);
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(contractAddress, subscriptionServiceABI, signer);

      await contract.cancelUserSubscription(planId).then((tx) => tx.wait());

      // Refresh data
      await fetchSubscribedPlans(walletAddress);
      await fetchAllPlans(walletAddress);

      // Refresh balances
      updateAllBalances();
    } catch (error) {
      console.error(`Error canceling subscription for plan ${planId}:`, error);
      alert("Failed to cancel subscription. Check the console for details.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Cancels the creation of a new subscription plan in the UI.
   */
  const handleCancelCreate = () => {
    setIsCreating(false);
    setNewPlan({ name: "", price: "", duration: "" });
  };

  /**
   * Fetch all plans initially or when the wallet address changes.
   */
  useEffect(() => {
    fetchAllPlans(walletAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  /**
   * If the wallet is connected, also fetch created and subscribed plans.
   */
  useEffect(() => {
    if (walletAddress) {
      fetchCreatedPlans(walletAddress);
      fetchSubscribedPlans(walletAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  /**
   * Renders the "All Plans" tab content.
   */
  const renderAllPlansTab = () => {
    if (isLoading) {
      return (
        <div className="text-center">
          <div className="loader"></div>
          <p>Loading all plans...</p>
        </div>
      );
    }

    if (allPlans.length === 0) {
      return <p className="text-center text-gray">No plans available.</p>;
    }

    return (
      <div className="subscription-list">
        {allPlans.map((plan) => {
          const expiryDate = formatDate(plan.userSubExpiry);
          return (
            <div key={plan.planId} className="subscription-row">
              <span className="subscription-id">Plan ID: {plan.planId}</span>
              <span className="subscription-name">{plan.name}</span>
              <span className="subscription-price">{plan.displayPrice} USDC</span>
              <span className="subscription-duration">{plan.duration} days</span>

              <button
                className="subscribe-button"
                disabled={plan.userSubActive || isSubmitting}
                onClick={() => handleSubscribe(plan.planId, plan.rawPrice)}
              >
                {plan.userSubActive
                  ? `Expires on ${expiryDate}`
                  : isSubmitting
                  ? "Subscribing..."
                  : "Subscribe"}
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Renders the "My Created" tab content (plans created by the user).
   */
  const renderCreatedPlansTab = () => {
    if (createdPlans.length === 0) {
      return <p className="text-center text-gray">You haven't created any plans.</p>;
    }

    return (
      <div className="subscription-list">
        {createdPlans.map((plan) => (
          <div key={plan.planId} className="subscription-row">
            <span className="subscription-id">Plan ID: {plan.planId}</span>
            <span className="subscription-name">{plan.name}</span>
            <span className="subscription-price">{plan.displayPrice} USDC</span>
            <span className="subscription-duration">{plan.duration} days</span>
          </div>
        ))}
      </div>
    );
  };

  /**
   * Renders the "My Subscribed" tab content (plans the user is subscribed to).
   */
  const renderSubscribedPlansTab = () => {
    if (subscribedPlans.length === 0) {
      return <p className="text-center text-gray">You have no active subscriptions.</p>;
    }

    return (
      <div>
        <div className="subscription-header subscription-row">
          <span className="subscription-id">Plan ID</span>
          <span className="subscription-name">Plan Name</span>
          <span className="subscription-price">Price</span>
          <span className="subscription-duration">Duration</span>
          <span className="subscription-status">Status</span>
          <span className="subscription-auto-renew">Auto-Renew</span>
          <span className="subscription-cancel">Cancel</span>
        </div>

        <div className="subscription-list">
          {subscribedPlans.map((plan) => {
            const expiryDate = formatDate(plan.userSubExpiry);
            const isExpired = !plan.userSubActive;
            const isAutoRenew = plan.userSubAutoRenew;

            return (
              <div key={plan.planId} className="subscription-row">
                <span className="subscription-id">{plan.planId}</span>
                <span className="subscription-name">{plan.name}</span>
                <span className="subscription-price">{plan.displayPrice} USDC</span>
                <span className="subscription-duration">{plan.duration} days</span>

                <span className="subscription-status">
                  {plan.userSubActive ? (
                    <span style={{ color: "green" }}>Active until {expiryDate}</span>
                  ) : (
                    <span style={{ color: "red" }}>Expired</span>
                  )}
                  {isExpired && isAutoRenew && (
                    <button
                      className="renew-button"
                      onClick={() => handleManualRenew(plan.planId, plan.rawPrice)}
                      disabled={isSubmitting}
                    >
                      Renew Now
                    </button>
                  )}
                </span>

                <div className="subscription-auto-renew toggle-switch">
                  <input
                    type="checkbox"
                    id={`autoRenew-${plan.planId}`}
                    checked={isAutoRenew}
                    onChange={(e) =>
                      handleToggleAutoRenew(plan.planId, e.target.checked)
                    }
                    disabled={isSubmitting || isExpired}
                  />
                  <label htmlFor={`autoRenew-${plan.planId}`} />
                </div>

                <div className="subscription-cancel">
                  <button
                    className="cancel-sub-button"
                    disabled={isExpired || isSubmitting}
                    onClick={() => handleCancelSubscription(plan.planId)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <div
        style={{
          marginBottom: "20px",
          display: "flex",
          justifyContent: "center",
          gap: "10px"
        }}
      >
        <button
          className={`create-button ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Plans
        </button>
        <button
          className={`create-button ${activeTab === "created" ? "active" : ""}`}
          onClick={() => setActiveTab("created")}
          disabled={!walletAddress}
        >
          My Created
        </button>
        <button
          className={`create-button ${activeTab === "subscribed" ? "active" : ""}`}
          onClick={() => setActiveTab("subscribed")}
          disabled={!walletAddress}
        >
          My Subscribed
        </button>
      </div>

      {activeTab === "all" && (
        <>
          <h1 className="title">All Subscription Plans</h1>
          {renderAllPlansTab()}
        </>
      )}

      {activeTab === "created" && (
        <>
          <h1 className="title">My Created Plans</h1>
          {renderCreatedPlansTab()}

          {walletAddress && (
            <div className="create-section">
              {!isCreating ? (
                <button className="create-button" onClick={() => setIsCreating(true)}>
                  + Create New Plan
                </button>
              ) : (
                <form
                  className="create-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createSubscriptionPlan();
                  }}
                >
                  <div className="form-group">
                    <input
                      type="text"
                      placeholder="Plan Name"
                      value={newPlan.name}
                      onChange={(e) =>
                        setNewPlan({ ...newPlan, name: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      placeholder="Price (USDC)"
                      value={newPlan.price}
                      onChange={(e) =>
                        setNewPlan({ ...newPlan, price: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      placeholder="Duration (days)"
                      value={newPlan.duration}
                      onChange={(e) =>
                        setNewPlan({ ...newPlan, duration: e.target.value })
                      }
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="create-submit-button"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "Submitting..." : "Submit"}
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={handleCancelCreate}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === "subscribed" && (
        <>
          <h1 className="title">My Subscribed Plans</h1>
          {renderSubscribedPlansTab()}
        </>
      )}
    </div>
  );
}

/* 
  ===========================================
    4) MAIN APP COMPONENT
  ===========================================
*/

/**
 * The main SubscriptionApp component that combines:
 *  - ConnectWallet (to connect wallet and handle balances)
 *  - SubscriptionList (to display and manage subscriptions)
 * 
 * It maintains shared states (e.g., walletAddress, usdcBalance, platformEarnings)
 * and provides a unified function for refreshing all balances.
 */
export default function SubscriptionApp() {
  const [walletAddress, setWalletAddress] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState("");
  const [platformEarnings, setPlatformEarnings] = useState("");

  const testUsdcAddress = process.env.REACT_APP_USDC_CONTRACT_ADDRESS;
  const subscriptionContractAddr = process.env.REACT_APP_SUBSCRIPTION_CONTRACT_ADDRESS;

  /**
   * updateAllBalances is called whenever the app needs to refresh both the
   * user's wallet balance and the user's earnings on the platform.
   */
  const updateAllBalances = async () => {
    if (!walletAddress) return;
    const updatedBalance = await fetchUSDCBalance(walletAddress, testUsdcAddress);
    setUsdcBalance(updatedBalance);

    const updatedEarnings = await fetchCreatorEarnings(walletAddress, subscriptionContractAddr);
    setPlatformEarnings(updatedEarnings);
  };

  /**
   * Whenever the wallet address changes (i.e., user connects),
   * refresh the balances.
   */
  useEffect(() => {
    if (walletAddress) {
      updateAllBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  return (
    <div className="page">
      <ConnectWallet
        walletAddress={walletAddress}
        setWalletAddress={setWalletAddress}
        usdcBalance={usdcBalance}
        setUsdcBalance={setUsdcBalance}
        platformEarnings={platformEarnings}
        setPlatformEarnings={setPlatformEarnings}
      />

      <SubscriptionList
        walletAddress={walletAddress}
        usdcBalance={usdcBalance}
        platformEarnings={platformEarnings}
        updateAllBalances={updateAllBalances}
      />
    </div>
  );
}