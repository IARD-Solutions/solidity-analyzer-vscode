// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract VulnerableBase {
    // Visibility issue - should be private or internal
    uint256 secretValue = 100;
    
    // Missing event for critical state change
    mapping(address => uint256) public balances;
    
    // Storing password on-chain - bad practice
    bytes32 private adminPassword = keccak256(abi.encodePacked("password123"));
    
    // Block values as time source - unreliable
    function isItTime() public view returns (bool) {
        return block.number % 10 == 0;
    }
    
    // Dangerous delegatecall vulnerability
    function executeCode(address _contract, bytes memory _data) public {
        // No access control
        (bool success, ) = _contract.delegatecall(_data);
        require(success, "Execution failed");
    }
    
    // Signature replay vulnerability - missing nonce
    function withdrawWithSignature(uint256 amount, bytes memory signature) public {
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, amount));
        address signer = recoverSigner(messageHash, signature);
        
        // No nonce, so signature can be reused
        if (signer == owner()) {
            payable(msg.sender).transfer(amount);
        }
    }
    
    // Missing input validation
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    // Unchecked return value
    function unsafeTransfer(address payable recipient, uint256 amount) public {
        recipient.call{value: amount}("");
        // No check for success
        balances[msg.sender] -= amount;
    }
    
    // Helper function for signature verification
    function recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        return ecrecover(messageHash, v, r, s);
    }
    
    // Virtual function to be overridden
    function owner() public virtual view returns (address) {
        return address(0);
    }
}
