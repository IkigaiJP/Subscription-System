const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS = "0xe533D647bd4B562AdD5EcAe66BC10546b02229c5";

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
