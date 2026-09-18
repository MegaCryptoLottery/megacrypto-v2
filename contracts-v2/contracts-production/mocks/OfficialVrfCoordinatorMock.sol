// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

interface IOfficialVrfConsumer { function rawFulfillRandomWords(uint256 requestId, uint256[] calldata words) external; }

/// @dev Local-only ABI-compatible coordinator harness. It calls the official
/// consumer entrypoint exactly as a coordinator does; it does not replace any
/// production Chainlink coordinator.
contract OfficialVrfCoordinatorMock {
    struct RandomWordsRequest { bytes32 keyHash; uint256 subId; uint16 requestConfirmations; uint32 callbackGasLimit; uint32 numWords; bytes extraArgs; }
    uint256 public nextRequestId = 1;
    bool public revertRequests;
    bool public returnZero;
    uint256 public forcedRequestId;
    mapping(uint256 => address) public consumerForRequest;
    bytes public lastExtraArgs;
    function setFailureMode(bool revert_, bool zero_) external { revertRequests = revert_; returnZero = zero_; }
    function setForcedRequestId(uint256 id) external { forcedRequestId = id; }
    function requestRandomWords(RandomWordsRequest calldata request) external returns (uint256 requestId) {
        require(!revertRequests, "REQUEST_REVERT");
        lastExtraArgs = request.extraArgs;
        if (returnZero) return 0;
        requestId = forcedRequestId == 0 ? nextRequestId++ : forcedRequestId;
        consumerForRequest[requestId] = msg.sender;
    }
    function fulfill(uint256 requestId, uint256 word) external {
        uint256[] memory words = new uint256[](1); words[0] = word;
        IOfficialVrfConsumer(consumerForRequest[requestId]).rawFulfillRandomWords(requestId, words);
    }
}

