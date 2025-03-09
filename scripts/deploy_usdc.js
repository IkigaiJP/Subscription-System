const hre = require("hardhat");

async function main() {
    const TestUSDC = await hre.ethers.getContractFactory("TestUSDC");
    const usdc = await TestUSDC.deploy();

    await usdc.waitForDeployment();
    console.log("Test USDC deployed to:", await usdc.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
