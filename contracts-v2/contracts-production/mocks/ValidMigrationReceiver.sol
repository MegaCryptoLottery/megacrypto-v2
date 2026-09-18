// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Local-only valid successor used to verify the production candidate's
/// migration handshake and accounting boundary. It never handles player claims.
contract ValidMigrationReceiver {
    bytes4 internal constant MIGRATION_MAGIC = bytes4(keccak256("MegaCryptoLotteryMigrationReceiverV2"));
    address public receivedToken;
    uint256 public receivedAmount;
    uint256 public receiveCount;

    function migrationReceiverMagic(address, uint256) external pure returns (bytes4) {
        return MIGRATION_MAGIC;
    }

    function receiveMigration(address token, uint256 amount) external {
        receivedToken = token;
        receivedAmount = amount;
        receiveCount++;
    }
}

