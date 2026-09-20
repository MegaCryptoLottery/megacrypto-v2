import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask, winningMask } from './helpers.mjs';

const production = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const candidateArtifact = production['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const coordinatorArtifact = production['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;

async function fixture(decimals = 6) {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0), player = await provider.getSigner(1), attacker = await provider.getSigner(2);
  const deploy = async (a, args, signer = owner) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [decimals]);
  const coordinator = await deploy(coordinatorArtifact, []);
  const config = { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const economics = { ticketPrice: 5n * 10n ** BigInt(decimals), roundDuration: 7 * 24 * 60 * 60, jackpotBps: 5000, weeklyBps: 3800, maintenanceBps: 600, oracleBps: 600, maintenanceWallet: await owner.getAddress(), oracleWallet: await owner.getAddress() };
  const lottery = await deploy(candidateArtifact, [await token.getAddress(), decimals, economics, config, await owner.getAddress()]);
  for (const signer of [player, attacker]) { await (await token.mint(await signer.getAddress(), 100000n * 10n ** BigInt(decimals))).wait(); await (await token.connect(signer).approve(await lottery.getAddress(), ethers.MaxUint256)).wait(); }
  return { provider, owner, player, attacker, token, coordinator, lottery };
}
const assertSolvent = async (lottery) => assert.equal((await lottery.solvency())[2], true);

describe('official-import production candidate', function () {
  it('runs the authenticated VRF lifecycle, bounded settlement, claim, and next round', async () => {
    const { lottery, player, provider, coordinator, token } = await fixture();
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask([1, 2, 3])));
    await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await assertSolvent(lottery);
    await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait();
    assert.equal(await lottery.requestIdToRoundId(1), 1n); await assert.rejects(lottery.connect(player).rawFulfillRandomWords(1, [44]));
    await (await coordinator.fulfill(1, 44)).wait(); const after = await lottery.rounds(1); assert.equal(after.drawMethod, 1n); assert.equal(after.winningMask, BigInt(winningMask(44n)));
    await (await lottery.processSettlement(1, 1)).wait(); assert.equal((await lottery.rounds(1)).state, 5n); const entitlement = await lottery.ticketEntitlement(1, 0); assert.equal(entitlement[3], true); await (await lottery.connect(player).claim(1, 0)).wait(); await assert.rejects(lottery.connect(player).claim(1, 0)); await assertSolvent(lottery);
    await (await lottery.openNextRound()).wait(); assert.equal(await lottery.currentRoundId(), 2n); assert.ok((await token.balanceOf(await lottery.getAddress())) >= 0n);
  });
  it('rejects zero/reverting VRF requests and preserves manual contingency against a late official callback', async () => {
    const { lottery, player, provider, coordinator } = await fixture(); await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait();
    await (await coordinator.setFailureMode(false, true)).wait(); await assert.rejects(lottery.requestRandomness(1).then((tx) => tx.wait())); const afterZero = await lottery.rounds(1); assert.equal(afterZero.requestId, 0n); assert.equal(afterZero.state, 1n);
    const next = await fixture(); await (await next.lottery.connect(next.player).buyTicket(ticketMask())).wait(); await advance(next.provider, 7 * 24 * 60 * 60 + 1); await (await next.lottery.closeRound(1)).wait(); await (await next.lottery.requestRandomness(1)).wait(); await advance(next.provider, 3 * 24 * 60 * 60 + 1); await (await next.lottery.executeManualContingency(1, 7, ethers.id('timeout'), ethers.id('evidence'), { gasLimit: 500000 })).wait();
    assert.equal((await next.lottery.rounds(1)).drawMethod, 2n); await assert.rejects(next.coordinator.fulfill(1, 99).then((tx) => tx.wait())); await assertSolvent(next.lottery);
  });
  it('preserves exact token scaling for both supported USDT decimal conventions', async () => { for (const decimals of [6, 18]) { const { lottery } = await fixture(decimals); assert.equal(await lottery.usdtDecimals(), BigInt(decimals)); assert.equal((await lottery.rounds(1)).ticketPrice, 5n * 10n ** BigInt(decimals)); } });
  it('enforces Chainlink two-step ownership and does not affect earned claims', async () => {
    const { lottery, owner, player, attacker, provider, coordinator } = await fixture();
    await assert.rejects(lottery.connect(attacker).setEmergencyAuthority(await attacker.getAddress()));
    await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait(); await (await coordinator.fulfill(1, 5)).wait(); await (await lottery.processSettlement(1, 1)).wait();
    await (await lottery.connect(owner).transferOwnership(await attacker.getAddress())).wait(); await assert.rejects(lottery.connect(attacker).proposeFutureVrfConfig(await lottery.vrfConfig(1)).then((tx) => tx.wait())); await (await lottery.connect(attacker).acceptOwnership()).wait(); assert.equal(await lottery.owner(), await attacker.getAddress());
    await (await lottery.connect(attacker).setEmergencyAuthority(await attacker.getAddress())).wait(); await (await lottery.connect(attacker).setEmergencyPause(true, ethers.ZeroHash)).wait(); await assert.rejects(lottery.connect(player).buyTicket(ticketMask())); await (await lottery.connect(player).claim(1, 0)).wait(); await assertSolvent(lottery);
  });
  it('rejects invalid lifecycle transitions without mutating a round', async () => {
    const { lottery, player, provider, coordinator } = await fixture();
    await assert.rejects(lottery.closeRound(1)); await assert.rejects(lottery.requestRandomness(1)); await assert.rejects(lottery.processSettlement(1, 1)); await assert.rejects(lottery.openNextRound());
    await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await assert.rejects(lottery.closeRound(1).then((tx) => tx.wait())); await assert.rejects(lottery.executeManualContingency(1, 1, ethers.ZeroHash, ethers.ZeroHash, { gasLimit: 500000 }).then((tx) => tx.wait()));
    await (await lottery.requestRandomness(1)).wait(); await assert.rejects(lottery.requestRandomness(1).then((tx) => tx.wait())); await assert.rejects(lottery.processSettlement(1, 1).then((tx) => tx.wait())); await (await coordinator.fulfill(1, 4)).wait(); await assert.rejects(lottery.executeManualContingency(1, 1, ethers.ZeroHash, ethers.ZeroHash, { gasLimit: 500000 }).then((tx) => tx.wait())); assert.equal((await lottery.rounds(1)).state, 3n); await assertSolvent(lottery);
  });
  it('keeps the VRF coordinator immutable while permitting delayed same-coordinator parameter snapshots', async () => {
    const { lottery, player, provider, coordinator, owner } = await fixture();
    const deploy = async (a, args = []) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args); await c.waitForDeployment(); return c; };
    const otherCoordinator = await deploy(coordinatorArtifact);
    const original = await lottery.vrfConfig(1);
    const config = (changes = {}) => ({ coordinator: original.coordinator, subscriptionId: original.subscriptionId, keyHash: original.keyHash, callbackGasLimit: original.callbackGasLimit, requestConfirmations: original.requestConfirmations, numWords: original.numWords, payWithNative: original.payWithNative, ...changes });
    await assert.rejects(lottery.proposeFutureVrfConfig(config({ coordinator: await otherCoordinator.getAddress() })));
    await (await lottery.connect(player).buyTicket(ticketMask())).wait(); await advance(provider, 7 * 24 * 60 * 60 + 1); await (await lottery.closeRound(1)).wait(); await (await lottery.requestRandomness(1)).wait();
    await (await lottery.proposeFutureVrfConfig(config({ keyHash: ethers.id('future-parameters') }))).wait(); await advance(provider, 2 * 24 * 60 * 60 + 1); await (await lottery.activateFutureVrfConfig()).wait();
    assert.equal((await lottery.vrfConfig(2)).coordinator, await coordinator.getAddress());
    await (await coordinator.fulfill(1, 91)).wait(); assert.equal((await lottery.rounds(1)).drawMethod, 1n);
  });
});
