// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @dev Local adversarial harness. It deliberately attempts re-entry while a
/// candidate requests randomness; it is never a production coordinator.
interface IReentryLotteryTarget {
    function requestRandomness(uint256 id) external;
    function executeManualContingency(uint256 id, uint256 entropy, bytes32 reason, bytes32 evidence) external;
    function processSettlement(uint256 id, uint256 count) external;
    function closeRound(uint256 id) external;
    function openNextRound() external;
    function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external;
}

contract HostileVrfCoordinator {
    struct RandomWordsRequest {
        bytes32 keyHash;
        uint256 subId;
        uint16 requestConfirmations;
        uint32 callbackGasLimit;
        uint32 numWords;
        bytes extraArgs;
    }

    address public target;
    uint256 public targetRoundId;
    uint256 public nextRequestId = 1;
    uint256 public requestCount;
    bool public attackEnabled;
    bool public reentrancyAttempted;
    uint8 public observedState;
    bool public observedRequestPending;
    uint256 public observedRequestId;
    uint256 public observedRequestMapping;

    bool public requestReentrySucceeded;
    bool public manualReentrySucceeded;
    bool public settlementReentrySucceeded;
    bool public callbackReentrySucceeded;
    bool public closeReentrySucceeded;
    bool public openNextReentrySucceeded;
    bytes public requestReentryRevertData;
    bytes public manualReentryRevertData;
    bytes public settlementReentryRevertData;
    bytes public callbackReentryRevertData;
    bytes public closeReentryRevertData;
    bytes public openNextReentryRevertData;

    event ReentryAttempt(bytes4 indexed selector, bool success, bytes revertData);

    function configureAttack(address target_, uint256 roundId_) external {
        target = target_;
        targetRoundId = roundId_;
    }

    function setAttackEnabled(bool enabled) external { attackEnabled = enabled; }

    function requestRandomWords(RandomWordsRequest calldata) external returns (uint256 requestId) {
        requestCount++;
        requestId = nextRequestId;
        if (target != address(0) && attackEnabled) {
            reentrancyAttempted = true;
            _recordStagedRequest(requestId);
            (requestReentrySucceeded, requestReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.requestRandomness, (targetRoundId))
            );
            (manualReentrySucceeded, manualReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.executeManualContingency, (targetRoundId, 1, bytes32("manual"), bytes32("evidence")))
            );
            (settlementReentrySucceeded, settlementReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.processSettlement, (targetRoundId, 1))
            );
            uint256[] memory words = new uint256[](1);
            words[0] = 123;
            (callbackReentrySucceeded, callbackReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.rawFulfillRandomWords, (requestId, words))
            );
            (closeReentrySucceeded, closeReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.closeRound, (targetRoundId))
            );
            (openNextReentrySucceeded, openNextReentryRevertData) = _attempt(
                abi.encodeCall(IReentryLotteryTarget.openNextRound, ())
            );
        }
        nextRequestId++;
    }

    function fulfill(uint256 requestId, uint256 word) external {
        uint256[] memory words = new uint256[](1);
        words[0] = word;
        IReentryLotteryTarget(target).rawFulfillRandomWords(requestId, words);
    }

    function _attempt(bytes memory data) private returns (bool success, bytes memory revertData) {
        (success, revertData) = target.call(data);
        bytes4 selector;
        assembly { selector := mload(add(data, 32)) }
        emit ReentryAttempt(selector, success, revertData);
    }

    function _recordStagedRequest(uint256 requestId) private {
        (bool ok, bytes memory data) = target.staticcall(abi.encodeWithSignature("rounds(uint256)", targetRoundId));
        require(ok && data.length >= 480, "ROUND_READ_FAILED");
        // ABI words: state=0, requestId=13, requestPending=14.
        uint256 stateWord;
        uint256 requestIdWord;
        uint256 requestPendingWord;
        assembly {
            stateWord := mload(add(data, 32))
            requestIdWord := mload(add(data, 448))
            requestPendingWord := mload(add(data, 480))
        }
        // Ordinary assignments preserve Solidity's packed bool/uint8 storage.
        observedState = uint8(stateWord);
        observedRequestId = requestIdWord;
        observedRequestPending = requestPendingWord != 0;
        (ok, data) = target.staticcall(abi.encodeWithSignature("requestIdToRoundId(uint256)", requestId));
        require(ok && data.length == 32, "MAPPING_READ_FAILED");
        observedRequestMapping = abi.decode(data, (uint256));
    }
}

