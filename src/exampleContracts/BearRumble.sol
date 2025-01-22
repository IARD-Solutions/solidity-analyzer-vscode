// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
 
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
 
/**
 * @title  Bears Rumble ERC20 Contract
 * @author IARD Solutions: https://iard.solutions - Web3 Experts suited to your needs. Web3 | Consulting | Innovations
 * @author Bears Rumble:
 * @notice This contract is the ERC20 token contract for Bears Rumble.
 *          It is based on OpenZeppelin's ERC20Burnable contract.
 *
 *  BearsRumble is a Play2Earn & Free2Play multiplayer Web3 Game
 *  Socials:
 *  - Website:https://bearsrumble.com/
 *  - Twitter:https://x.com/BearsRumble
 *  - Telegram:https://t.me/BearsRumble
 *  - Discord:https://discord.com/invite/bearsrumble
 */
 
contract BearsRumble is ERC20Burnable {
    constructor() ERC20("BearsRumble", "BR") {
        _mint(msg.sender, 1_000_000_000 * 10 ** decimals());
    }
}