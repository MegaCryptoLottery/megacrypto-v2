import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, winningMask } from './helpers.mjs';

const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const Lottery = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const Coordinator = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const ValidReceiver = compiled['mocks/ValidMigrationReceiver.sol'].ValidMigrationReceiver;
const Hostile = compiled['mocks/HostileMigrationSuccessors.sol'];
const ROUND_DURATION = 604800;
const MIGRATION_DELAY = 604800;

async function fixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0), winner = await provider.getSigner(1), outsider = await provider.getSigner(2);
  const deploy = async (a, args = [], signer = owner) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(Coordinator);
  const lottery = await deploy(Lottery, [await token.getAddress(), 6, ROUND_DURATION, 5000000n, { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true }, await owner.getAddress()]);
  await (await token.mint(await winner.getAddress(), 100000000n)).wait();
  await (await token.connect(winner).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, winner, outsider, token, coordinator, lottery, deploy };
}

async function liabilityFixture() {
  const z = await fixture();
  const mask = winningMask(777n);
  await (await z.lottery.connect(z.winner).buyTicket(mask)).wait();
  await advance(z.provider, ROUND_DURATION + 1);
  await (await z.lottery.closeRound(1)).wait();
  await (await z.lottery.requestRandomness(1)).wait();
  await (await z.coordinator.fulfill(1, 777)).wait();
  await (await z.lottery.processSettlement(1, 1)).wait();
  assert.equal((await z.lottery.rounds(1)).state, 5n);
  assert.equal(await z.lottery.playerLiabilities(), 4400000n);
  return z;
}

async function snapshot(z, successor) {
  const entitlement = await z.lottery.ticketEntitlement(1, 0);
  return {
    oldBalance: await z.token.balanceOf(await z.lottery.getAddress()),
    successorBalance: await z.token.balanceOf(successor),
    playerLiabilities: await z.lottery.playerLiabilities(),
    jackpotReserve: await z.lottery.jackpotReserve(),
    maintenanceReserve: await z.lottery.maintenanceReserve(),
    oracleReserve: await z.lottery.oracleReserve(),
    unallocatedDustReserve: await z.lottery.unallocatedDustReserve(),
    migrationState: await z.lottery.migrationState(),
    proposedSuccessor: await z.lottery.proposedSuccessor(),
    migrationExecutableAt: await z.lottery.migrationExecutableAt(),
    entitlement: Array.from(entitlement)
  };
}

async function matureProposal(z, successor) {
  await (await z.lottery.proposeMigration(successor)).wait();
  await advance(z.provider, MIGRATION_DELAY + 1);
}

describe('production candidate hostile successor gate', function () {
  it('rejects zero, EOA, wrong-magic, token/chain mismatch, malformed, and reverting validation atomically', async () => {
    const cases = [
      ['zero address', async (z) => ethers.ZeroAddress],
      ['EOA', async (z) => z.outsider.getAddress()],
      ['wrong handshake', async (z) => (await z.deploy(Hostile.WrongMagicMigrationReceiver)).getAddress()],
      ['wrong token', async (z) => (await z.deploy(Hostile.ConfigCheckingMigrationReceiver, [await z.outsider.getAddress(), 31337])).getAddress()],
      ['wrong chain ID', async (z) => (await z.deploy(Hostile.ConfigCheckingMigrationReceiver, [await z.token.getAddress(), 999999n])).getAddress()],
      ['malformed ABI', async (z) => (await z.deploy(Hostile.MalformedMigrationReceiver)).getAddress()],
      ['validation revert', async (z) => (await z.deploy(Hostile.RevertingValidationMigrationReceiver)).getAddress()]
    ];
    for (const [, successorFor] of cases) {
      const z = await liabilityFixture();
      const successor = await successorFor(z);
      const before = await snapshot(z, successor);
      await assert.rejects(z.lottery.proposeMigration(successor).then((tx) => tx.wait()));
      assert.deepEqual(await snapshot(z, successor), before, 'failed successor validation must be atomic');
      assert.ok((await z.token.balanceOf(await z.lottery.getAddress())) >= await z.lottery.playerLiabilities());
    }
  });

  it('rolls back a fake-compatible successor that reverts in its receipt callback', async () => {
    const z = await liabilityFixture();
    const receiver = await z.deploy(Hostile.ReceiptRevertingMigrationReceiver);
    await matureProposal(z, await receiver.getAddress());
    const before = await snapshot(z, await receiver.getAddress());
    await assert.rejects(z.lottery.executeMigration().then((tx) => tx.wait()));
    assert.deepEqual(await snapshot(z, await receiver.getAddress()), before, 'transfer and state changes must roll back with receipt failure');
    assert.ok(before.oldBalance >= before.playerLiabilities);
  });

  it('neutralizes a fake-compatible reentrant receiver, prevents duplicate migration, and preserves old claims', async () => {
    const z = await liabilityFixture();
    const receiver = await z.deploy(Hostile.ReentrantMigrationReceiver);
    await (await receiver.setOldLottery(await z.lottery.getAddress())).wait();
    const before = await snapshot(z, await receiver.getAddress());
    const expectedMigratable = before.oldBalance - before.playerLiabilities;
    await matureProposal(z, await receiver.getAddress());
    await (await z.lottery.executeMigration()).wait();

    assert.equal(await receiver.receivedAmount(), expectedMigratable);
    assert.equal(await receiver.receiveCount(), 1n);
    assert.equal(await receiver.executeAttempted(), true);
    assert.equal(await receiver.executeSucceeded(), false, 'executeMigration is protected by ReentrancyGuard');
    assert.equal(await receiver.proposeAttempted(), true);
    assert.equal(await receiver.proposeSucceeded(), false, 'receiver is not the owner');
    assert.equal(await receiver.claimAttempted(), true);
    assert.equal(await receiver.claimSucceeded(), false, 'receiver owns no historical ticket');
    for (const key of ['executeRevertData', 'proposeRevertData', 'claimRevertData']) assert.ok((await receiver[key]()).length > 2);

    assert.equal(await z.lottery.migrationState(), 3n);
    assert.equal(await z.token.balanceOf(await receiver.getAddress()), expectedMigratable);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), before.playerLiabilities);
    assert.equal(await z.lottery.playerLiabilities(), before.playerLiabilities);
    await assert.rejects(z.lottery.executeMigration().then((tx) => tx.wait()));
    assert.equal(await receiver.receiveCount(), 1n, 'no second receipt callback is possible');
    assert.equal(await z.token.balanceOf(await receiver.getAddress()), expectedMigratable, 'no second transfer is possible');

    const entitlement = await z.lottery.ticketEntitlement(1, 0);
    const claimAmount = entitlement[4];
    const winnerBalance = await z.token.balanceOf(await z.winner.getAddress());
    await (await z.lottery.connect(z.winner).claim(1, 0)).wait();
    assert.equal((await z.token.balanceOf(await z.winner.getAddress())) - winnerBalance, claimAmount);
    assert.equal(await z.lottery.playerLiabilities(), 0n);
    assert.equal(await z.token.balanceOf(await z.lottery.getAddress()), 0n);
    await assert.rejects(z.lottery.connect(z.winner).claim(1, 0).then((tx) => tx.wait()));
  });

  it('uses the exact candidate handshake inputs for token and chain identity', async () => {
    const z = await liabilityFixture();
    const receiver = await z.deploy(Hostile.ConfigCheckingMigrationReceiver, [await z.token.getAddress(), 31337n]);
    await (await z.lottery.proposeMigration(await receiver.getAddress())).wait();
    assert.equal(await z.lottery.migrationState(), 1n, 'a receiver that validates supplied token and chain values passes');
  });
});

