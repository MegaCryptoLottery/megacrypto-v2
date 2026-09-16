// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Deliberately non-standard test token: transferFrom takes a 1% fee.
contract MockFeeToken {
    uint8 public immutable decimals;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    constructor(uint8 decimals_) { decimals = decimals_; }
    function mint(address to, uint256 amount) external { balanceOf[to] += amount; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transfer(address to, uint256 amount) external returns (bool) { _move(msg.sender, to, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) { require(allowance[from][msg.sender] >= amount, "ALLOWANCE"); allowance[from][msg.sender] -= amount; uint256 received = amount - amount / 100; _move(from, to, received); balanceOf[from] -= amount - received; return true; }
    function _move(address from, address to, uint256 amount) internal { require(balanceOf[from] >= amount, "BALANCE"); balanceOf[from] -= amount; balanceOf[to] += amount; }
}

