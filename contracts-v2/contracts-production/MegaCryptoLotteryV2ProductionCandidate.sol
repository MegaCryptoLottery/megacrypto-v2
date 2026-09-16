// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/*
 * PRODUCTION-CANDIDATE INTEGRATION SKELETON — NOT COMPILED IN THIS WORKSPACE.
 *
 * This file deliberately imports the exact official libraries required for the
 * final candidate. It is not a deployable replacement for the tested local
 * reference until those exact dependencies are installed, compiled, and
 * independently audited. See docs/hardened-v2-pretestnet-gate.md.
 */
import {VRFConsumerBaseV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";
import {VRFV2PlusClient} from "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import {IVRFCoordinatorV2Plus} from "@chainlink/contracts/src/v0.8/vrf/dev/interfaces/IVRFCoordinatorV2Plus.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Import/API verification target for the final audited implementation.
/// @dev The actual state machine remains in the local reference pending a clean
///      official-dependency build and independent review. The coordinator is
///      immutable in VRFConsumerBaseV2Plus; changing coordinators requires a
///      successor migration, not a mutable config setter.
abstract contract MegaCryptoLotteryV2ProductionCandidate is
    VRFConsumerBaseV2Plus,
    AutomationCompatibleInterface,
    Ownable2Step,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    IERC20 internal immutable i_usdt;
    IVRFCoordinatorV2Plus internal immutable i_vrfCoordinator;

    constructor(address usdt, address coordinator, address initialOwner)
        VRFConsumerBaseV2Plus(coordinator)
        Ownable(initialOwner)
    {
        i_usdt = IERC20(usdt);
        i_vrfCoordinator = IVRFCoordinatorV2Plus(coordinator);
    }

    function checkUpkeep(bytes calldata) external view virtual override returns (bool, bytes memory);
    function performUpkeep(bytes calldata) external virtual override;
    function fulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) internal virtual override;

    function _vrfExtraArgs(bool nativePayment) internal pure returns (bytes memory) {
        return VRFV2PlusClient._argsToBytes(VRFV2PlusClient.ExtraArgsV1({nativePayment: nativePayment}));
    }
}

