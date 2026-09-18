// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

abstract contract MigrationReceiverBase {
    bytes4 internal constant MIGRATION_MAGIC = bytes4(keccak256("MegaCryptoLotteryMigrationReceiverV2"));
    function migrationReceiverMagic(address, uint256) external view virtual returns (bytes4);
    function receiveMigration(address, uint256) external virtual;
}

contract WrongMagicMigrationReceiver is MigrationReceiverBase {
    function migrationReceiverMagic(address, uint256) external pure override returns (bytes4) { return 0xdeadbeef; }
    function receiveMigration(address, uint256) external pure override {}
}

/// @dev Proves the candidate supplies both identity values to the handshake.
contract ConfigCheckingMigrationReceiver is MigrationReceiverBase {
    address public immutable expectedToken;
    uint256 public immutable expectedChainId;
    constructor(address token, uint256 chainId) { expectedToken = token; expectedChainId = chainId; }
    function migrationReceiverMagic(address token, uint256 chainId) external view override returns (bytes4) {
        return token == expectedToken && chainId == expectedChainId ? MIGRATION_MAGIC : bytes4(0);
    }
    function receiveMigration(address, uint256) external pure override {}
}

contract MalformedMigrationReceiver {
    fallback() external {
        assembly { mstore(0, 0x01) return(31, 1) }
    }
}

contract RevertingValidationMigrationReceiver is MigrationReceiverBase {
    function migrationReceiverMagic(address, uint256) external pure override returns (bytes4) { revert("VALIDATION_REVERT"); }
    function receiveMigration(address, uint256) external pure override {}
}

/// @dev It passes public compatibility validation but rejects the receipt hook.
contract ReceiptRevertingMigrationReceiver is MigrationReceiverBase {
    function migrationReceiverMagic(address, uint256) external pure override returns (bytes4) { return MIGRATION_MAGIC; }
    function receiveMigration(address, uint256) external pure override { revert("RECEIPT_REVERT"); }
}

/// @dev It passes the handshake, then tries meaningful old-contract mutations
/// from inside the receipt hook. All calls are captured rather than propagated.
contract ReentrantMigrationReceiver is MigrationReceiverBase {
    address public oldLottery;
    bool public executeAttempted;
    bool public executeSucceeded;
    bytes public executeRevertData;
    bool public proposeAttempted;
    bool public proposeSucceeded;
    bytes public proposeRevertData;
    bool public claimAttempted;
    bool public claimSucceeded;
    bytes public claimRevertData;
    uint256 public receivedAmount;
    uint256 public receiveCount;

    function setOldLottery(address old_) external { oldLottery = old_; }
    function migrationReceiverMagic(address, uint256) external pure override returns (bytes4) { return MIGRATION_MAGIC; }

    function receiveMigration(address, uint256 amount) external override {
        receivedAmount = amount;
        receiveCount++;
        executeAttempted = true;
        (executeSucceeded, executeRevertData) = oldLottery.call(abi.encodeWithSignature("executeMigration()"));
        proposeAttempted = true;
        (proposeSucceeded, proposeRevertData) = oldLottery.call(abi.encodeWithSignature("proposeMigration(address)", address(this)));
        claimAttempted = true;
        (claimSucceeded, claimRevertData) = oldLottery.call(abi.encodeWithSignature("claim(uint256,uint256)", 1, 0));
    }
}

