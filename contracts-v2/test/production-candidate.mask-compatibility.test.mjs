import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask, winningMask } from './helpers.mjs';

const production = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const candidate = production['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const coordinatorArtifact = production['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const popcount = (value) => { let count = 0; for (let n = value; n !== 0; n &= n - 1) count++; return count; };
const numbersForMask = (mask) => Array.from({ length: 25 }, (_, index) => index + 1).filter((number) => (mask & (1 << number)) !== 0);

async function fixture() {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0);
  const player = await provider.getSigner(1);
  const deploy = async (item, args) => { const contract = await new ethers.ContractFactory(item.abi, item.evm.bytecode.object, owner).deploy(...args); await contract.waitForDeployment(); return contract; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(coordinatorArtifact, []);
  const economics = { ticketPrice: 5_000_000n, roundDuration: 7 * 24 * 60 * 60, jackpotBps: 5000, weeklyBps: 3800, maintenanceBps: 600, oracleBps: 600, maintenanceWallet: await owner.getAddress(), oracleWallet: await owner.getAddress() };
  const vrf = { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const lottery = await deploy(candidate, [await token.getAddress(), 6, economics, vrf, await owner.getAddress()]);
  await (await token.mint(await player.getAddress(), 1_000_000_000n)).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, player, lottery, coordinator };
}

describe('production candidate mask compatibility', function () {
  it('uses the legacy and frontend convention: numbers 1..25 map to bits 1..25', () => {
    const firstFifteen = Array.from({ length: 15 }, (_, index) => index + 1);
    const expected = firstFifteen.reduce((mask, number) => mask | (1 << number), 0);
    assert.equal(ticketMask(firstFifteen), expected);
    assert.equal(ticketMask(firstFifteen) & 1, 0);
    assert.deepEqual(numbersForMask(ticketMask([1, 5, 25])), [1, 5, 25]);
  });

  it('accepts exactly 15 unique numbers including 25 and rejects reserved/out-of-range masks', async () => {
    const { lottery, player } = await fixture();
    const withTwentyFive = ticketMask([...Array.from({ length: 14 }, (_, index) => index + 1), 25]);
    await (await lottery.connect(player).buyTicket(withTwentyFive)).wait();
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 14 }, (_, index) => index + 1))).then((tx) => tx.wait()));
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 16 }, (_, index) => index + 1))).then((tx) => tx.wait()));
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 14 }, (_, index) => index + 1)) | 1).then((tx) => tx.wait()));
    await assert.rejects(lottery.connect(player).buyTicket(ticketMask(Array.from({ length: 14 }, (_, index) => index + 1)) | (1 << 26)).then((tx) => tx.wait()));
  });

  it('generates 15-number winning masks without bit 0 or bits above 25', () => {
    for (const word of [0n, 1n, 44n, 77n, 999999n]) {
      const mask = winningMask(word);
      assert.equal(popcount(mask), 15);
      assert.equal(mask & 1, 0);
      assert.equal(mask >>> 26, 0);
    }
  });

  it('matches the frontend helper and scores intersections containing numbers 1 and 25 on-chain', async () => {
    let word = 0n;
    let winner = 0;
    while ((winner & (1 << 1)) === 0 || (winner & (1 << 25)) === 0) { winner = winningMask(word++); }
    const selected = numbersForMask(winner);
    const remove = selected.find((number) => number !== 1 && number !== 25);
    const replacement = Array.from({ length: 25 }, (_, index) => index + 1).find((number) => !selected.includes(number));
    const nearWinner = (winner & ~(1 << remove)) | (1 << replacement);
    assert.equal(popcount(winner & nearWinner), 14);
    assert.ok((winner & nearWinner & (1 << 1)) !== 0);
    assert.ok((winner & nearWinner & (1 << 25)) !== 0);

    const { lottery, player, provider, coordinator } = await fixture();
    await (await lottery.connect(player).buyTicket(winner)).wait();
    await (await lottery.connect(player).buyTicket(nearWinner)).wait();
    await advance(provider, 7 * 24 * 60 * 60 + 1);
    await (await lottery.closeRound(1)).wait();
    await (await lottery.requestRandomness(1)).wait();
    await (await coordinator.fulfill(1, word - 1n)).wait();
    assert.equal((await lottery.rounds(1)).winningMask, BigInt(winner));
    await (await lottery.processSettlement(1, 2)).wait();
    const exact = await lottery.ticketEntitlement(1, 0);
    const near = await lottery.ticketEntitlement(1, 1);
    assert.equal(exact[2], 15n);
    assert.equal(near[2], 14n);
  });

  it('keeps exact 15-number ties and jackpot/weekly award accounting intact', async () => {
    const word = 444n;
    const mask = winningMask(word);
    const { lottery, player, provider, coordinator } = await fixture();
    await (await lottery.connect(player).buyTicket(mask)).wait();
    await (await lottery.connect(player).buyTicket(mask)).wait();
    await advance(provider, 7 * 24 * 60 * 60 + 1);
    await (await lottery.closeRound(1)).wait();
    await (await lottery.requestRandomness(1)).wait();
    await (await coordinator.fulfill(1, word)).wait();
    await (await lottery.processSettlement(1, 2)).wait();
    const round = await lottery.rounds(1);
    assert.equal(round.bestScore, 15n);
    assert.equal(round.finalistCount, 2n);
    assert.equal(round.totalAward, 8_800_000n);
    assert.equal((await lottery.ticketEntitlement(1, 0))[4], 4_400_000n);
    assert.equal((await lottery.ticketEntitlement(1, 1))[4], 4_400_000n);
  });
});
