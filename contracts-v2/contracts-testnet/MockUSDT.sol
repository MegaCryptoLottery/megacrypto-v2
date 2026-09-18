// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice TESTNET ONLY — NOT PRODUCTION AND NOT REAL USDT.
/// @dev Deterministic owner-controlled minting exists solely for Amoy test plans.
contract MockUSDT {
    string public constant name = "Mock USDT";
    string public constant symbol = "USDT";
    uint8 public constant decimals = 6;
    uint256 public totalSupply;
    address public immutable owner;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor() { owner = msg.sender; }
    modifier onlyOwner() { require(msg.sender == owner, "ONLY_TESTNET_OWNER"); _; }

    function transfer(address to, uint256 value) external returns (bool) { _transfer(msg.sender, to, value); return true; }
    function approve(address spender, uint256 value) external returns (bool) { allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true; }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 permitted = allowance[from][msg.sender];
        if (permitted != type(uint256).max) { require(permitted >= value, "ALLOWANCE"); allowance[from][msg.sender] = permitted - value; emit Approval(from, msg.sender, allowance[from][msg.sender]); }
        _transfer(from, to, value); return true;
    }
    function mint(address to, uint256 value) external onlyOwner { require(to != address(0), "ZERO_ADDRESS"); totalSupply += value; balanceOf[to] += value; emit Transfer(address(0), to, value); }
    function _transfer(address from, address to, uint256 value) private { require(to != address(0), "ZERO_ADDRESS"); require(balanceOf[from] >= value, "BALANCE"); balanceOf[from] -= value; balanceOf[to] += value; emit Transfer(from, to, value); }
}

