import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask } from './helpers.mjs';

const production = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const candidate = production['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const coordinatorArtifact = production['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const WEEK = 7 * 24 * 60 * 60;
const MONDAY_0000_UTC = 4 * 24 * 60 * 60; // Sunday 20:00 New York while UTC-4; operators change this for DST.
const TUESDAY_0000_UTC = 5 * 24 * 60 * 60;

async function fixture(initialOffset = MONDAY_0000_UTC) {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0), player = await provider.getSigner(1);
  const deploy = async (a, args) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(coordinatorArtifact, []);
  const economics = { ticketPrice: 5_000_000n, roundDuration: WEEK, jackpotBps: 5000, weeklyBps: 3800, maintenanceBps: 600, oracleBps: 600, maintenanceWallet: await owner.getAddress(), oracleWallet: await owner.getAddress() };
  const vrf = { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const lottery = await deploy(candidate, [await token.getAddress(), 6, economics, initialOffset, vrf, await owner.getAddress()]);
  await (await token.mint(await player.getAddress(), 100_000_000n)).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, player, token, coordinator, lottery };
}

async function completeAndOpenNext(x) {
  const id = await x.lottery.currentRoundId();
  const cutoff = (await x.lottery.rounds(id)).cutoffAt;
  const now = BigInt((await x.provider.getBlock('latest')).timestamp);
  if (cutoff >= now) await advance(x.provider, Number(cutoff - now) + 1);
  await (await x.lottery.closeRound(id)).wait();
  await (await x.lottery.openNextRound()).wait();
}

describe('production candidate weekly anchored calendar', function () {
  it('uses the constructor UTC weekday/clock cutoff for Round 1 and retains 50/38/6/6 purchase accounting', async () => {
    const x = await fixture();
    const round = await x.lottery.rounds(1);
    assert.equal(round.cutoffAt % BigInt(WEEK), BigInt(MONDAY_0000_UTC));
    const beforeOwner = await x.token.balanceOf(await x.owner.getAddress());
    await (await x.lottery.connect(x.player).buyTicket(ticketMask())).wait();
    assert.equal((await x.lottery.rounds(1)).weeklyPool, 1_900_000n);
    assert.equal((await x.lottery.jackpotReserve()), 2_500_000n);
    assert.equal((await x.token.balanceOf(await x.owner.getAddress())) - beforeOwner, 600_000n);
  });

  it('keeps successive rounds exactly one scheduled week apart despite delayed openings', async () => {
    const x = await fixture();
    const cutoff1 = (await x.lottery.rounds(1)).cutoffAt;
    await advance(x.provider, Number(cutoff1 - BigInt((await x.provider.getBlock('latest')).timestamp)) + 2 * 24 * 60 * 60);
    await (await x.lottery.closeRound(1)).wait(); await (await x.lottery.openNextRound()).wait();
    const cutoff2 = (await x.lottery.rounds(2)).cutoffAt;
    assert.equal(cutoff2, cutoff1 + BigInt(WEEK));
    await advance(x.provider, Number(cutoff2 - BigInt((await x.provider.getBlock('latest')).timestamp)) + 3 * 24 * 60 * 60);
    await (await x.lottery.closeRound(2)).wait(); await (await x.lottery.openNextRound()).wait();
    assert.equal((await x.lottery.rounds(3)).cutoffAt, cutoff2 + BigInt(WEEK));
  });

  it('opens at the next scheduled cutoff after a delayed VRF/settlement lifecycle', async () => {
    const x = await fixture();
    await (await x.lottery.connect(x.player).buyTicket(ticketMask())).wait();
    const cutoff1 = (await x.lottery.rounds(1)).cutoffAt;
    await advance(x.provider, Number(cutoff1 - BigInt((await x.provider.getBlock('latest')).timestamp)) + 3 * 24 * 60 * 60);
    await (await x.lottery.closeRound(1)).wait(); await (await x.lottery.requestRandomness(1)).wait();
    await advance(x.provider, 5 * 24 * 60 * 60); await (await x.coordinator.fulfill(1, 42)).wait(); await (await x.lottery.processSettlement(1, 1)).wait(); await (await x.lottery.openNextRound()).wait();
    assert.equal((await x.lottery.rounds(2)).cutoffAt, cutoff1 + 2n * BigInt(WEEK));
  });

  it('time-locks and validates calendar changes without altering the active round cutoff', async () => {
    const x = await fixture(); const activeCutoff = (await x.lottery.rounds(1)).cutoffAt;
    const invalid = await fixture(0);
    await assert.rejects((async () => { const deploy = new ethers.ContractFactory(candidate.abi, candidate.evm.bytecode.object, invalid.owner); return deploy.deploy(await invalid.token.getAddress(), 6, { ticketPrice: 5_000_000n, roundDuration: WEEK, jackpotBps: 5000, weeklyBps: 3800, maintenanceBps: 600, oracleBps: 600, maintenanceWallet: await invalid.owner.getAddress(), oracleWallet: await invalid.owner.getAddress() }, WEEK, { coordinator: await invalid.coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await invalid.owner.getAddress()); })());
    await assert.rejects(x.lottery.proposeWeeklyCutoff(WEEK));
    await assert.rejects(x.lottery.connect(x.player).proposeWeeklyCutoff(MONDAY_0000_UTC));
    await (await x.lottery.proposeWeeklyCutoff(TUESDAY_0000_UTC)).wait();
    await assert.rejects(x.lottery.activateWeeklyCutoff());
    assert.equal((await x.lottery.rounds(1)).cutoffAt, activeCutoff);
    await advance(x.provider, WEEK); await (await x.lottery.activateWeeklyCutoff({ gasLimit: 500_000n })).wait();
    assert.equal((await x.lottery.rounds(1)).cutoffAt, activeCutoff);
    await completeAndOpenNext(x);
    assert.equal((await x.lottery.rounds(2)).cutoffAt % BigInt(WEEK), BigInt(TUESDAY_0000_UTC));
  });
});
