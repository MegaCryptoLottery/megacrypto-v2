// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20Like, SafeERC20, IVRFV2PlusCoordinator, IAutomationCompatible, IMigrationReceiver} from "./Interfaces.sol";

/// @notice Local-development reference implementation. No deployment configuration is included.
contract MegaCryptoLotteryHardenedV2 is IAutomationCompatible {
    using SafeERC20 for IERC20Like;
    uint16 public constant JACKPOT_BPS = 5_000;
    uint16 public constant WEEKLY_BPS = 3_800;
    uint16 public constant MAINTENANCE_BPS = 600;
    uint16 public constant ORACLE_BPS = 600;
    uint16 public constant BPS = 10_000;
    uint256 public constant TICKET_NUMBERS = 15;
    uint256 public constant MAX_NUMBER = 25;
    uint256 public constant MIGRATION_DELAY = 7 days;
    uint256 public constant CONFIG_DELAY = 2 days;
    uint256 public constant VRF_TIMEOUT = 3 days;
    uint256 public constant MAX_SETTLEMENT_BATCH = 200;
    bytes4 public constant MIGRATION_MAGIC = bytes4(keccak256("MegaCryptoLotteryMigrationReceiverV2"));

    enum RoundState { OPEN, CLOSED, VRF_REQUESTED, VRF_RECEIVED, SETTLEMENT, COMPLETED, EMERGENCY }
    enum MigrationState { NORMAL, MIGRATION_PROPOSED, MIGRATION_READY, MIGRATED_CLAIMS_ONLY }
    enum Action { CLOSE, REQUEST, SETTLE, OPEN_NEXT }

    struct VrfConfig {
        address coordinator;
        uint256 subscriptionId;
        bytes32 keyHash;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
        uint32 numWords;
        bool payWithNative;
    }
    struct Round {
        RoundState state;
        uint64 openedAt;
        uint64 cutoffAt;
        uint64 closedAt;
        uint64 requestedAt;
        uint64 completedAt;
        uint128 ticketPrice;
        uint64 ticketStart;
        uint64 ticketCount;
        uint64 settlementCursor;
        uint8 bestScore;
        uint64 finalistCount;
        uint32 winningMask;
        uint256 requestId;
        bool requestPending;
        uint256 weeklyPool;
        uint256 jackpotContribution;
        uint256 totalAward;
        uint256 configVersion;
    }
    struct Ticket { address player; uint32 mask; }

    IERC20Like public immutable usdt;
    uint8 public immutable usdtDecimals;
    address public owner;
    address public pendingOwner;
    address public emergencyAuthority;
    bool public paused;
    bool private entered;
    uint64 public immutable roundDuration;
    uint256 public currentRoundId;
    uint256 public nextTicketIndex;
    uint256 public jackpotReserve;
    uint256 public maintenanceReserve;
    uint256 public oracleReserve;
    uint256 public unallocatedDustReserve;
    uint256 public playerLiabilities;
    uint256 public configVersion;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => mapping(uint256 => bool)) public ticketProcessed;
    mapping(uint256 => mapping(uint256 => bool)) public ticketClaimed;
    mapping(uint256 => uint256) public requestIdToRoundId;
    mapping(uint256 => VrfConfig) private vrfConfigs;
    VrfConfig private proposedVrfConfig;
    uint256 public proposedConfigAt;
    address public proposedSuccessor;
    uint256 public migrationProposedAt;
    uint256 public migrationExecutableAt;
    MigrationState public migrationState;

    event RoundOpened(uint256 indexed roundId, uint256 cutoffAt, uint256 ticketPrice, address token, uint256 configVersion);
    event TicketPurchased(uint256 indexed roundId, uint256 indexed ticketIndex, address indexed player, uint32 numberMask, uint256 paid);
    event RoundClosed(uint256 indexed roundId, uint256 ticketCount, uint256 cutoffAt);
    event RandomnessRequested(uint256 indexed roundId, uint256 indexed requestId, address coordinator, uint256 configVersion);
    event RandomnessFulfilled(uint256 indexed roundId, uint256 indexed requestId, uint32 winningMask);
    event SettlementProgress(uint256 indexed roundId, uint256 cursor, uint8 bestScore, uint256 finalists);
    event RoundSettled(uint256 indexed roundId, uint32 winningMask, uint8 bestScore, uint256 finalistCount, uint256 totalAward, uint256 dustToJackpot, uint256 jackpotRollover);
    event PrizeAllocated(uint256 indexed roundId, uint256 indexed ticketIndex, address indexed player, uint256 amount, bool jackpotPrize);
    event PrizeClaimed(uint256 indexed roundId, uint256 indexed ticketIndex, address indexed player, uint256 amount);
    event ManualContingencyExecuted(uint256 indexed roundId, uint256 indexed originalRequestId, bytes32 reasonHash, bytes32 evidenceHash, address actor);
    event EmergencyPaused(bool paused, bytes32 reasonHash, address actor);
    event VrfConfigProposed(uint256 indexed nextVersion, bytes32 configHash, uint256 executableAt);
    event VrfConfigActivated(uint256 indexed version, bytes32 configHash);
    event MigrationProposed(address indexed successor, uint256 executableAt);
    event MigrationCancelled(address indexed successor);
    event MigrationExecuted(address indexed successor, uint256 amount, uint256 protectedLiabilities);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed pendingOwner);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() { require(msg.sender == owner, "OWNER"); _; }
    modifier onlyEmergency() { require(msg.sender == emergencyAuthority || msg.sender == owner, "EMERGENCY"); _; }
    modifier nonReentrant() { require(!entered, "REENTRANCY"); entered = true; _; entered = false; }
    modifier whenNotPaused() { require(!paused, "PAUSED"); _; }

    constructor(address usdt_, uint8 expectedDecimals, uint64 roundDuration_, uint128 ticketPrice_, VrfConfig memory initialConfig_, address emergencyAuthority_) {
        require(usdt_ != address(0) && initialConfig_.coordinator != address(0), "ZERO_ADDRESS");
        require(roundDuration_ >= 1 days && ticketPrice_ > 0, "BAD_INIT");
        require(uint256(JACKPOT_BPS) + WEEKLY_BPS + MAINTENANCE_BPS + ORACLE_BPS == BPS, "BPS");
        usdt = IERC20Like(usdt_);
        require(usdt.decimals() == expectedDecimals, "DECIMALS");
        usdtDecimals = expectedDecimals;
        owner = msg.sender;
        emergencyAuthority = emergencyAuthority_ == address(0) ? msg.sender : emergencyAuthority_;
        roundDuration = roundDuration_;
        configVersion = 1;
        vrfConfigs[1] = initialConfig_;
        _openRound(ticketPrice_);
    }

    function transferOwnership(address nextOwner) external onlyOwner { require(nextOwner != address(0), "ZERO_OWNER"); pendingOwner = nextOwner; emit OwnershipTransferStarted(owner, nextOwner); }
    function acceptOwnership() external { require(msg.sender == pendingOwner, "PENDING_OWNER"); address old = owner; owner = msg.sender; pendingOwner = address(0); emit OwnershipTransferred(old, msg.sender); }
    function setEmergencyAuthority(address next) external onlyOwner { require(next != address(0), "ZERO_AUTHORITY"); emergencyAuthority = next; }
    function setEmergencyPause(bool next, bytes32 reasonHash) external onlyEmergency { paused = next; emit EmergencyPaused(next, reasonHash, msg.sender); }

    function buyTicket(uint32 numberMask) external nonReentrant whenNotPaused {
        Round storage r = rounds[currentRoundId];
        require(migrationState == MigrationState.NORMAL && r.state == RoundState.OPEN, "SALES_CLOSED");
        require(block.timestamp < r.cutoffAt, "CUTOFF");
        require(_isValidTicketMask(numberMask), "INVALID_TICKET");
        // Reject deflationary/fee-on-transfer ticket tokens: accounting is denominated in
        // the exact raw USDT amount actually received, never in a nominal transfer amount.
        uint256 beforeBalance = usdt.balanceOf(address(this));
        usdt.safeTransferFrom(msg.sender, address(this), r.ticketPrice);
        require(usdt.balanceOf(address(this)) == beforeBalance + r.ticketPrice, "UNSUPPORTED_TOKEN_BEHAVIOR");
        uint256 paid = r.ticketPrice;
        uint256 jackpotShare = paid * JACKPOT_BPS / BPS;
        uint256 weeklyShare = paid * WEEKLY_BPS / BPS;
        uint256 maintenanceShare = paid * MAINTENANCE_BPS / BPS;
        uint256 oracleShare = paid * ORACLE_BPS / BPS;
        uint256 ticketDust = paid - jackpotShare - weeklyShare - maintenanceShare - oracleShare;
        r.jackpotContribution += jackpotShare;
        r.weeklyPool += weeklyShare;
        jackpotReserve += jackpotShare;
        maintenanceReserve += maintenanceShare;
        oracleReserve += oracleShare;
        unallocatedDustReserve += ticketDust;
        uint256 ticketIndex = nextTicketIndex++;
        tickets[ticketIndex] = Ticket(msg.sender, numberMask);
        r.ticketCount++;
        emit TicketPurchased(currentRoundId, ticketIndex, msg.sender, numberMask, paid);
    }

    function checkUpkeep(bytes calldata) external view returns (bool needed, bytes memory data) {
        Round storage r = rounds[currentRoundId];
        if (migrationState != MigrationState.NORMAL || paused) return (false, bytes(""));
        if (r.state == RoundState.OPEN && block.timestamp >= r.cutoffAt) return (true, abi.encode(currentRoundId, Action.CLOSE, uint256(0)));
        if (r.state == RoundState.CLOSED && r.ticketCount > 0 && r.requestId == 0) return (true, abi.encode(currentRoundId, Action.REQUEST, uint256(0)));
        if ((r.state == RoundState.VRF_RECEIVED || r.state == RoundState.SETTLEMENT) && r.settlementCursor < r.ticketCount) return (true, abi.encode(currentRoundId, Action.SETTLE, uint256(200)));
        if (r.state == RoundState.COMPLETED) return (true, abi.encode(currentRoundId, Action.OPEN_NEXT, uint256(0)));
        return (false, bytes(""));
    }

    function performUpkeep(bytes calldata performData) external whenNotPaused {
        (uint256 roundId, Action action, uint256 maxTickets) = abi.decode(performData, (uint256, Action, uint256));
        require(roundId == currentRoundId && migrationState == MigrationState.NORMAL, "STALE_ACTION");
        if (action == Action.CLOSE) _closeRound(roundId);
        else if (action == Action.REQUEST) _requestRandomness(roundId);
        else if (action == Action.SETTLE) _processSettlement(roundId, maxTickets);
        else if (action == Action.OPEN_NEXT) _openNextRound();
        else revert("UNKNOWN_ACTION");
    }

    function closeRound(uint256 roundId) external whenNotPaused { _closeRound(roundId); }
    function requestRandomness(uint256 roundId) external whenNotPaused { _requestRandomness(roundId); }
    function processSettlement(uint256 roundId, uint256 maxTickets) external whenNotPaused { _processSettlement(roundId, maxTickets); }
    function openNextRound() external whenNotPaused { _openNextRound(); }

    function _closeRound(uint256 roundId) internal {
        Round storage r = rounds[roundId];
        require(roundId == currentRoundId && r.state == RoundState.OPEN && block.timestamp >= r.cutoffAt, "NOT_CLOSABLE");
        r.state = RoundState.CLOSED; r.closedAt = uint64(block.timestamp); r.ticketStart = uint64(nextTicketIndex - r.ticketCount);
        emit RoundClosed(roundId, r.ticketCount, r.cutoffAt);
        if (r.ticketCount == 0) { r.state = RoundState.COMPLETED; r.completedAt = uint64(block.timestamp); emit RoundSettled(roundId, 0, 0, 0, 0, 0, jackpotReserve); }
    }

    function _requestRandomness(uint256 roundId) internal {
        Round storage r = rounds[roundId];
        require(roundId == currentRoundId && r.state == RoundState.CLOSED && r.ticketCount > 0 && r.requestId == 0 && !r.requestPending, "NOT_REQUESTABLE");
        VrfConfig memory c = vrfConfigs[r.configVersion];
        r.state = RoundState.VRF_REQUESTED; r.requestPending = true; r.requestedAt = uint64(block.timestamp);
        // The state transition precedes the external coordinator interaction.
        IVRFV2PlusCoordinator.RandomWordsRequest memory request;
        request.keyHash = c.keyHash;
        request.subId = c.subscriptionId;
        request.requestConfirmations = c.requestConfirmations;
        request.callbackGasLimit = c.callbackGasLimit;
        request.numWords = c.numWords;
        request.extraArgs = abi.encode(c.payWithNative);
        uint256 requestId = IVRFV2PlusCoordinator(c.coordinator).requestRandomWords(request);
        require(requestId != 0 && requestIdToRoundId[requestId] == 0, "BAD_REQUEST_ID");
        r.requestId = requestId; requestIdToRoundId[requestId] = roundId;
        emit RandomnessRequested(roundId, requestId, c.coordinator, r.configVersion);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] calldata words) external nonReentrant {
        uint256 roundId = requestIdToRoundId[requestId];
        require(roundId != 0 && words.length > 0, "UNKNOWN_REQUEST");
        Round storage r = rounds[roundId]; VrfConfig storage c = vrfConfigs[r.configVersion];
        require(msg.sender == c.coordinator && r.state == RoundState.VRF_REQUESTED && r.requestId == requestId, "INVALID_CALLBACK");
        r.winningMask = _winningMask(words[0]); r.requestPending = false; r.state = RoundState.VRF_RECEIVED;
        emit RandomnessFulfilled(roundId, requestId, r.winningMask);
    }

    function _processSettlement(uint256 roundId, uint256 maxTickets) internal {
        Round storage r = rounds[roundId];
        require(roundId == currentRoundId && (r.state == RoundState.VRF_RECEIVED || r.state == RoundState.SETTLEMENT), "NOT_SETTLING");
        require(maxTickets > 0 && maxTickets <= MAX_SETTLEMENT_BATCH, "BAD_BATCH"); r.state = RoundState.SETTLEMENT;
        uint256 end = r.settlementCursor + maxTickets; if (end > r.ticketCount) end = r.ticketCount;
        for (uint256 offset = r.settlementCursor; offset < end; ++offset) {
            require(!ticketProcessed[roundId][offset], "DUPLICATE_TICKET"); ticketProcessed[roundId][offset] = true;
            uint8 score = _popcount(tickets[uint256(r.ticketStart) + offset].mask & r.winningMask);
            if (score > r.bestScore) { r.bestScore = score; r.finalistCount = 1; } else if (score == r.bestScore) { r.finalistCount++; }
        }
        r.settlementCursor = uint64(end); emit SettlementProgress(roundId, end, r.bestScore, r.finalistCount);
        if (end == r.ticketCount) _finalize(roundId);
    }

    function _finalize(uint256 roundId) internal {
        Round storage r = rounds[roundId]; require(r.finalistCount > 0, "NO_FINALISTS");
        uint256 award = r.weeklyPool; bool jackpotPrize = r.bestScore == TICKET_NUMBERS;
        if (jackpotPrize) { award += jackpotReserve; jackpotReserve = 0; } else { jackpotReserve += 0; }
        uint256 distributableAward = award - (award % r.finalistCount);
        uint256 dust = award - distributableAward;
        r.totalAward = distributableAward; r.weeklyPool = 0; playerLiabilities += distributableAward; jackpotReserve += dust;
        r.state = RoundState.COMPLETED; r.completedAt = uint64(block.timestamp);
        emit RoundSettled(roundId, r.winningMask, r.bestScore, r.finalistCount, distributableAward, dust, jackpotReserve);
    }

    function claim(uint256 roundId, uint256 ticketOffset) external nonReentrant {
        Round storage r = rounds[roundId]; require(r.state == RoundState.COMPLETED && ticketOffset < r.ticketCount, "NOT_CLAIMABLE");
        uint256 ticketIndex = uint256(r.ticketStart) + ticketOffset; Ticket storage t = tickets[ticketIndex];
        require(t.player == msg.sender && !ticketClaimed[roundId][ticketOffset], "NOT_TICKET_OWNER");
        uint8 score = _popcount(t.mask & r.winningMask); require(score == r.bestScore, "NOT_WINNER");
        uint256 amount = r.totalAward / r.finalistCount; require(amount > 0, "NO_AWARD");
        ticketClaimed[roundId][ticketOffset] = true; playerLiabilities -= amount; usdt.safeTransfer(msg.sender, amount);
        emit PrizeAllocated(roundId, ticketIndex, msg.sender, amount, r.bestScore == TICKET_NUMBERS); emit PrizeClaimed(roundId, ticketIndex, msg.sender, amount);
    }

    function executeManualContingency(uint256 roundId, uint256 emergencyEntropy, bytes32 reasonHash, bytes32 evidenceHash) external onlyEmergency nonReentrant {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.VRF_REQUESTED && r.requestId != 0 && block.timestamp >= r.requestedAt + VRF_TIMEOUT, "VRF_STILL_PROGRESSING");
        r.state = RoundState.EMERGENCY; r.requestPending = false; r.winningMask = _winningMask(uint256(keccak256(abi.encode(emergencyEntropy, reasonHash, evidenceHash, block.prevrandao, roundId))));
        // No RandomnessFulfilled event is emitted for manual entropy: frontends can never
        // mistake the contingency path for Chainlink VRF merely from the result log.
        emit ManualContingencyExecuted(roundId, r.requestId, reasonHash, evidenceHash, msg.sender);
        r.state = RoundState.VRF_RECEIVED;
    }

    function proposeFutureVrfConfig(VrfConfig calldata next) external onlyOwner { require(next.coordinator != address(0), "ZERO_COORDINATOR"); proposedVrfConfig = next; proposedConfigAt = block.timestamp + CONFIG_DELAY; emit VrfConfigProposed(configVersion + 1, keccak256(abi.encode(next)), proposedConfigAt); }
    function activateFutureVrfConfig() external onlyOwner { require(proposedConfigAt != 0 && block.timestamp >= proposedConfigAt, "CONFIG_TIMELOCK"); configVersion++; vrfConfigs[configVersion] = proposedVrfConfig; emit VrfConfigActivated(configVersion, keccak256(abi.encode(proposedVrfConfig))); delete proposedConfigAt; }
    function vrfConfig(uint256 version) external view returns (VrfConfig memory) { return vrfConfigs[version]; }

    function proposeMigration(address successor) external onlyOwner {
        require(migrationState == MigrationState.NORMAL && successor != address(0) && successor.code.length > 0, "BAD_SUCCESSOR");
        require(IMigrationReceiver(successor).migrationReceiverMagic(address(usdt), block.chainid) == MIGRATION_MAGIC, "HANDSHAKE");
        proposedSuccessor = successor; migrationProposedAt = block.timestamp; migrationExecutableAt = block.timestamp + MIGRATION_DELAY; migrationState = MigrationState.MIGRATION_PROPOSED; emit MigrationProposed(successor, migrationExecutableAt);
    }
    function cancelMigration() external onlyOwner { require(migrationState == MigrationState.MIGRATION_PROPOSED, "NO_MIGRATION"); address previous = proposedSuccessor; proposedSuccessor = address(0); migrationProposedAt = 0; migrationExecutableAt = 0; migrationState = MigrationState.NORMAL; emit MigrationCancelled(previous); }
    function executeMigration() external onlyOwner nonReentrant {
        require(migrationState == MigrationState.MIGRATION_PROPOSED && block.timestamp >= migrationExecutableAt, "MIGRATION_TIMELOCK");
        Round storage r = rounds[currentRoundId]; require(r.state == RoundState.COMPLETED, "ACTIVE_ROUND");
        migrationState = MigrationState.MIGRATION_READY;
        uint256 amount = migratableBalance(); usdt.safeTransfer(proposedSuccessor, amount); IMigrationReceiver(proposedSuccessor).receiveMigration(address(usdt), amount);
        migrationState = MigrationState.MIGRATED_CLAIMS_ONLY; emit MigrationExecuted(proposedSuccessor, amount, playerLiabilities);
    }
    function protectedReserves() public view returns (uint256) { Round storage r = rounds[currentRoundId]; return jackpotReserve + maintenanceReserve + oracleReserve + unallocatedDustReserve + r.weeklyPool; }
    function migratableBalance() public view returns (uint256) { uint256 balance = usdt.balanceOf(address(this)); uint256 protected_ = playerLiabilities; return balance > protected_ ? balance - protected_ : 0; }
    function solvency() external view returns (uint256 balance, uint256 protected_, bool solvent) { balance = usdt.balanceOf(address(this)); protected_ = playerLiabilities + protectedReserves(); solvent = protected_ <= balance; }

    function _openNextRound() internal { require(rounds[currentRoundId].state == RoundState.COMPLETED && migrationState == MigrationState.NORMAL, "NOT_OPENABLE"); _openRound(rounds[currentRoundId].ticketPrice); }
    function _openRound(uint128 ticketPrice_) internal { currentRoundId++; Round storage r = rounds[currentRoundId]; r.state = RoundState.OPEN; r.openedAt = uint64(block.timestamp); r.cutoffAt = uint64(block.timestamp + roundDuration); r.ticketPrice = ticketPrice_; r.configVersion = configVersion; emit RoundOpened(currentRoundId, r.cutoffAt, ticketPrice_, address(usdt), configVersion); }
    function _winningMask(uint256 randomWord) internal pure returns (uint32 mask) { uint256 selected; uint256 nonce; while (selected < TICKET_NUMBERS) { uint256 n = uint256(keccak256(abi.encode(randomWord, nonce++))) % MAX_NUMBER; uint32 bit = uint32(1 << n); if (mask & bit == 0) { mask |= bit; selected++; } } }
    function _isValidTicketMask(uint32 mask) internal pure returns (bool) { return mask >> MAX_NUMBER == 0 && _popcount(mask) == TICKET_NUMBERS; }
    function _popcount(uint32 value) internal pure returns (uint8 count) { while (value != 0) { count++; value &= value - 1; } }
}

