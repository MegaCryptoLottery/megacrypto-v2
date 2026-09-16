// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IVRFV2PlusCoordinator} from "../Interfaces.sol";

interface IConsumer { function fulfillRandomWords(uint256 requestId, uint256[] calldata words) external; }

contract MockVrfCoordinator is IVRFV2PlusCoordinator {
    uint256 public nextRequestId = 1;
    mapping(uint256 => address) public consumerForRequest;
    bytes public lastExtraArgs;
    function requestRandomWords(RandomWordsRequest calldata request) external returns (uint256 requestId) { requestId = nextRequestId++; consumerForRequest[requestId] = msg.sender; lastExtraArgs = request.extraArgs; }
    function fulfill(uint256 requestId, uint256 word) external { uint256[] memory words = new uint256[](1); words[0] = word; IConsumer(consumerForRequest[requestId]).fulfillRandomWords(requestId, words); }
}

