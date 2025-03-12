// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {
        // Mint 1,000,000 tokens (6 decimals) = 1,000,000.000000
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    // Override decimals to make this token have 6 decimal places, like real USDC
    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    // Faucet method: mints 1,000.000000 to msg.sender
    function faucet() external {
        _mint(msg.sender, 1000 * 10 ** 6);
    }
}
