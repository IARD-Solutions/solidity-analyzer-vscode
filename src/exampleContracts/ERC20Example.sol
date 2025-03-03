// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
 
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
 
/**
 * @title   ERC20 Contract
 * @author IARD Solutions: https://iard.solutions - Web3 Experts suited to your needs. Web3 | Consulting | Innovations
 * @notice This contract is the ERC20 token contract for  .
 *          It is based on OpenZeppelin's ERC20Burnable contract.
 *
 */
 
contract ERC20Example is ERC20Burnable {
    constructor() ERC20("ERC20Example", "BR") {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}