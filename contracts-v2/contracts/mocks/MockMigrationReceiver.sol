// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IMigrationReceiver, IERC20Like} from "../Interfaces.sol";

contract MockMigrationReceiver is IMigrationReceiver {
    bytes4 public constant MAGIC = bytes4(keccak256("MegaCryptoLotteryMigrationReceiverV2"));
    address public receivedToken;
    uint256 public receivedAmount;
    function migrationReceiverMagic(address, uint256) external pure returns (bytes4) { return MAGIC; }
    function receiveMigration(address token, uint256 amount) external { require(IERC20Like(token).balanceOf(address(this)) >= amount, "NOT_RECEIVED"); receivedToken = token; receivedAmount += amount; }
}

contract InvalidMigrationReceiver { }

