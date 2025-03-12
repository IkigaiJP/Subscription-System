require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS = process.env.USDC_ADDRESS;

  if (!USDC_ADDRESS) {
    throw new Error("USDC_ADDRESS is not set in .env file");
  }

  const SubscriptionService = await hre.ethers.getContractFactory("SubscriptionService");
  const contract = await SubscriptionService.deploy(USDC_ADDRESS);

  await contract.waitForDeployment();
  console.log("SubscriptionService deployed to:", await contract.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
