// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestFile2.sol";

contract ChildContract is VulnerableBase {
    address private _owner;

    // Avoid shadowing the parent contract's state variable
    uint256 childSecretValue;

    // Vulnerable initialization - no constructor
    function initialize(address ownerAddress) public {
        // Missing onlyOnce modifier
        _owner = ownerAddress;
    }

    // Function default visibility (should be external)
    function transferTo(address payable recipient) public {
        // DOS with unexpected revert
        recipient.transfer(address(this).balance);
    }

    // Front-running vulnerability
    function commitToValue(uint256 value) public payable {
        // No protection against front-running
        if (value > 100) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }

    // Missing zero address check
    function setOwner(address newOwner) public {
        // Should check if newOwner != address(0)
        require(msg.sender == _owner, "Not authorized");
        _owner = newOwner;
    }

    // Hash collision vulnerability
    function checkUserCredentials(
        string memory username,
        string memory password
    ) public pure returns (bool) {
        // Unsafe hash comparison
        return
            keccak256(abi.encodePacked(username, password)) ==
            keccak256(abi.encodePacked("admin", "secret"));
    }

    // Timestamp manipulation vulnerability
    function isGoodTime() public view returns (bool) {
        return block.timestamp % 15 == 0;
    }

    // Integer overflow in low-level call
    function executeWithValue(address target) public payable {
        // Unchecked msg.value usage in calculation
        uint256 amount = msg.value * 10;
        (bool success, ) = target.call{value: amount}("");
        require(success, "Call failed");
    }

    // Override with access control issue
    function owner() public view override returns (address) {
        return _owner;
    }

    // Dangerous selfdestruct with no access control
    function shutdown() public {
        selfdestruct(payable(msg.sender));
    }
}
