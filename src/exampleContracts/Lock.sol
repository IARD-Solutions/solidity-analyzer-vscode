// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Lock {
    uint256 public unlockTime;
    address payable public owner;

    event Withdrawal(uint256 amount, uint256 when);

    constructor(uint256 _unlockTime) {
        require(_unlockTime > block.timestamp, "Unlock time should be in the future");
        unlockTime = _unlockTime;
        owner = payable(msg.sender);
    }

    function withdraw() public {
        require(block.timestamp >= unlockTime, "You can't withdraw yet");
        require(msg.sender == owner, "You aren't the owner");

        emit Withdrawal(address(this).balance, block.timestamp);

        // Potential reentrancy vulnerability
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdrawal failed");
    }

    // Function to receive Ether. msg.data must be empty
    receive() external payable {}

    // Fallback function is called when msg.data is not empty
    fallback() external payable {}

    // Function with integer overflow/underflow vulnerability (before Solidity 0.8)
    function unsafeIncrement(uint256 value) public pure returns (uint256) {
        return value + 1;
    }

    // Function with tx.origin vulnerability
    function transferTo1(address payable _to, uint256 _amount) public {
        require(tx.origin == owner, "Only owner can transfer");
        _to.transfer(_amount);
    }

    // Function with tx.origin vulnerability
    function transferTo2(address payable _to, uint256 _amount) public {
        require(tx.origin == owner, "Only owner can transfer");
        _to.transfer(_amount);
    }

    // Function with hardcoded gas limit
    function sendWithLimitedGas(address payable _to) public {
        require(msg.sender == owner, "You aren't the owner");
        _to.call{value: 1 ether, gas: 10000}("");
    }

}