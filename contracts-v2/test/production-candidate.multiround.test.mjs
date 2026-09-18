import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask, winningMask } from './helpers.mjs';

const production = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const candidateArtifact = production['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const coordinatorArtifact = production['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const WEEK = 7 * 24 * 60 * 60;
const PRICE = (decimals) => 5n * 10n ** BigInt(decimals);
const shardFlag = process.argv.indexOf('--shard');
// npm on Windows may consume the literal --shard flag but preserve its numeric
// value as the final argument; retain the documented npm invocation as well.
const trailingShard = /^\d$/.test(process.argv.at(-1) ?? '') ? Number(process.argv.at(-1)) : null;
const shard = shardFlag >= 0 ? Number(process.argv[shardFlag + 1]) : trailingShard;
const matricesOnly = process.argv.includes('--matrices-only');
if (shard !== null && (!Number.isInteger(shard) || shard < 0 || shard > 9)) throw new Error('Shard must be an integer from 0 to 9');

class AccountingOracle {
  constructor(price) { this.price = price; this.jackpot = 0n; this.weekly = 0n; this.maintenance = 0n; this.oracle = 0n; this.dust = 0n; this.liabilities = 0n; this.balance = 0n; }
  buy() {
    const j = this.price * 5000n / 10000n, w = this.price * 3800n / 10000n;
    const m = this.price * 600n / 10000n, o = this.price * 600n / 10000n;
    this.jackpot += j; this.weekly += w; this.maintenance += m; this.oracle += o;
    this.dust += this.price - j - w - m - o; this.balance += this.price;
  }
  finalize(bestScore, finalists) {
    let award = this.weekly;
    if (bestScore === 15) { award += this.jackpot; this.jackpot = 0n; }
    const distributed = award - award % BigInt(finalists);
    this.jackpot += award - distributed; this.liabilities += distributed; this.weekly = 0n;
    return { award: distributed, perWinner: distributed / BigInt(finalists) };
  }
  claim(amount) { this.liabilities -= amount; this.balance -= amount; }
}

async function fixture(decimals = 6) {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  // This is an ephemeral in-process provider; a short poll interval avoids
  // turning the required 500 real local receipt waits into a timeout.
  provider.pollingInterval = 5;
  const signers = await Promise.all([0, 1, 2, 3, 4].map((i) => provider.getSigner(i)));
  const deploy = async (a, args, signer = signers[0]) => { const c = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, signer).deploy(...args); await c.waitForDeployment(); return c; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [decimals]);
  const coordinator = await deploy(coordinatorArtifact, []);
  const config = { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const lottery = await deploy(candidateArtifact, [await token.getAddress(), decimals, WEEK, PRICE(decimals), config, await signers[0].getAddress()]);
  for (const signer of signers.slice(1)) { await (await token.mint(await signer.getAddress(), 1_000_000n * 10n ** BigInt(decimals))).wait(); await (await token.connect(signer).approve(await lottery.getAddress(), ethers.MaxUint256)).wait(); }
  return { provider, signers, token, coordinator, lottery, accounting: new AccountingOracle(PRICE(decimals)) };
}

const popcount = (x) => { let n = 0; while (x) { n++; x &= x - 1; } return n; };
const exactScoreMask = (winner, score) => {
  if (score === 15) return winner;
  let kept = 0, replacement = 0, need = score;
  for (let bit = 0; bit < 25; bit++) if ((winner & (1 << bit)) && need-- > 0) kept |= 1 << bit;
  for (let bit = 0; bit < 25 && popcount(replacement) < 15 - score; bit++) if (!(winner & (1 << bit))) replacement |= 1 << bit;
  return kept | replacement;
};
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };

async function assertAccounting(ctx, expectedWeekly = ctx.accounting.weekly) {
  const { lottery, token, accounting } = ctx;
  const r = await lottery.rounds(await lottery.currentRoundId());
  assert.equal(await lottery.jackpotReserve(), accounting.jackpot, 'jackpot reserve');
  assert.equal(r.weeklyPool, expectedWeekly, 'current weekly pool');
  assert.equal(await lottery.maintenanceReserve(), accounting.maintenance, 'maintenance reserve');
  assert.equal(await lottery.oracleReserve(), accounting.oracle, 'oracle reserve');
  assert.equal(await lottery.unallocatedDustReserve(), accounting.dust, 'ticket-rounding dust');
  assert.equal(await lottery.playerLiabilities(), accounting.liabilities, 'player liabilities');
  assert.equal(await token.balanceOf(await lottery.getAddress()), accounting.balance, 'contract token balance');
  assert.ok(accounting.liabilities + accounting.jackpot + expectedWeekly + accounting.maintenance + accounting.oracle + accounting.dust <= accounting.balance, 'independent solvency inequality');
}

async function completeRound(ctx, entries, word, { claims = [] } = {}) {
  const { lottery, coordinator, provider, accounting } = ctx;
  const id = await lottery.currentRoundId();
  const winner = winningMask(word);
  for (const { signer, mask } of entries) { await (await lottery.connect(signer).buyTicket(mask)).wait(); accounting.buy(); await assertAccounting(ctx); }
  await advance(provider, WEEK + 1); await (await lottery.closeRound(id)).wait();
  if (entries.length === 0) {
    const empty = await lottery.rounds(id); assert.equal(empty.state, 5n, 'empty round completes directly'); assert.equal(empty.requestId, 0n, 'empty round has no VRF request'); await assertAccounting(ctx, 0n); await (await lottery.openNextRound()).wait(); return { id, winner, award: 0n, winners: [] };
  }
  await (await lottery.requestRandomness(id)).wait(); const requested = await lottery.rounds(id); assert.equal(requested.state, 2n, 'VRF requested');
  await (await coordinator.fulfill(requested.requestId, word)).wait(); assert.equal((await lottery.rounds(id)).state, 3n, 'VRF received');
  await (await lottery.processSettlement(id, 200)).wait(); const done = await lottery.rounds(id); assert.equal(done.state, 5n, 'round completed');
  const scores = entries.map(({ mask }) => popcount(mask & winner)); const best = Math.max(...scores); const winners = scores.map((score, offset) => ({ offset, score, ...entries[offset] })).filter(({ score }) => score === best);
  const expected = accounting.finalize(best, winners.length);
  assert.equal(done.bestScore, BigInt(best), 'best score'); assert.equal(done.finalistCount, BigInt(winners.length), 'finalist count'); assert.equal(done.totalAward, expected.award, 'total award'); await assertAccounting(ctx, 0n);
  for (const offset of claims) { const entitlement = await lottery.ticketEntitlement(id, offset); assert.equal(entitlement[4], expected.perWinner, 'claim amount'); await (await lottery.connect(entries[offset].signer).claim(id, offset)).wait(); accounting.claim(expected.perWinner); await assertAccounting(ctx, 0n); }
  await (await lottery.openNextRound()).wait(); return { id, winner, award: expected.award, perWinner: expected.perWinner, winners };
}

describe('production candidate multi-round independent accounting gate', function () {
  this.timeout(900000);

  it(matricesOnly ? 'skips campaigns for the matrix-only gate pass' : 'completes deterministic seeded campaigns across 6- and 18-decimal tokens with independent accounting', async function () {
    if (matricesOnly) this.skip();
    const started = Date.now(); const stats = { campaigns: 0, rounds: 0, tickets: 0, comparisons: 0, six: 0, eighteen: 0 };
    const contexts = [await fixture(6), await fixture(18)];
    const firstCampaign = shard === null ? 0 : shard * 10;
    const campaignCount = shard === null ? 100 : 10;
    for (let campaign = firstCampaign; campaign < firstCampaign + campaignCount; campaign++) {
      const ctx = contexts[campaign % 2]; const next = rng(0xC0FFEE ^ campaign); if (campaign % 2) stats.eighteen++; else stats.six++;
      for (let step = 0; step < 5; step++) {
        const word = BigInt(next()); const winner = winningMask(word); const variant = next() % 5;
        const playerA = ctx.signers[1 + next() % 4], playerB = ctx.signers[1 + next() % 4];
        let entries;
        if (variant === 0) entries = [];
        else if (variant === 1) entries = [{ signer: playerA, mask: exactScoreMask(winner, 14) }];
        else if (variant === 2) entries = [{ signer: playerA, mask: exactScoreMask(winner, 14) }, { signer: playerB, mask: exactScoreMask(winner, 14) }];
        else if (variant === 3) entries = [{ signer: playerA, mask: winner }];
        else entries = [{ signer: playerA, mask: winner }, { signer: playerB, mask: winner }];
        const claimOffsets = entries.length && next() % 3 === 0 ? [0] : [];
        await completeRound(ctx, entries, word, { claims: claimOffsets });
        stats.campaigns += step === 4 ? 1 : 0; stats.rounds++; stats.tickets += entries.length; stats.comparisons += entries.length + 3;
      }
    }
    assert.equal(stats.campaigns, campaignCount); assert.equal(stats.rounds, campaignCount * 5); assert.ok(stats.tickets > 0); assert.equal(stats.six, campaignCount / 2); assert.equal(stats.eighteen, campaignCount / 2);
    if (shard === null) console.log(`MULTIROUND_STATS campaigns=${stats.campaigns} rounds=${stats.rounds} tickets=${stats.tickets} comparisons=${stats.comparisons} seed=0xC0FFEE elapsedMs=${Date.now() - started}`);
    else console.log(`MULTIROUND_SHARD_STATS shard=${shard} seed=0x${(0xC0FFEE ^ firstCampaign).toString(16)} campaigns=${stats.campaigns} rounds=${stats.rounds} tickets=${stats.tickets} accountingComparisons=${stats.comparisons} decimalsCoverage=6,18 elapsedMs=${Date.now() - started}`);
  });

  (shard === null || matricesOnly ? it : it.skip)('handles exact jackpot rollover and one, two, and ten winner allocations independently', async () => {
    for (const finalists of [1, 2, 10]) {
      const ctx = await fixture(6); const word = 77n; const winner = winningMask(word);
      for (let i = 0; i < 10; i++) { await completeRound(ctx, [{ signer: ctx.signers[1], mask: exactScoreMask(winner, 14) }], word); assert.equal(await ctx.lottery.jackpotReserve(), BigInt(i + 1) * PRICE(6) * 5000n / 10000n, 'rollover after each non-jackpot round'); }
      const entries = Array.from({ length: finalists }, (_, i) => ({ signer: ctx.signers[1 + (i % 4)], mask: winner }));
      const result = await completeRound(ctx, entries, word);
      assert.equal(await ctx.lottery.jackpotReserve(), 0n, 'even micro-unit allocation leaves no dust'); assert.equal(result.winners.length, finalists); assert.equal(result.perWinner * BigInt(finalists), result.award);
    }
  });

  (shard === null || matricesOnly ? it : it.skip)('allocates weekly prizes for one, tied, and same-wallet multiple winners', async () => {
    const ctx = await fixture(18); const word = 123n; const winner = winningMask(word);
    for (const entries of [
      [{ signer: ctx.signers[1], mask: exactScoreMask(winner, 14) }],
      [{ signer: ctx.signers[1], mask: exactScoreMask(winner, 14) }, { signer: ctx.signers[2], mask: exactScoreMask(winner, 14) }],
      Array.from({ length: 5 }, (_, i) => ({ signer: ctx.signers[1 + (i % 2)], mask: exactScoreMask(winner, 13) })),
    ]) { const result = await completeRound(ctx, entries, word); assert.equal(result.winners.length, entries.length); assert.equal(result.perWinner * BigInt(entries.length), result.award); }
  });

  (shard === null || matricesOnly ? it : it.skip)('preserves historical unclaimed claims through later rounds and rejects duplicate claims', async () => {
    const ctx = await fixture(6); const word = 456n; const winner = winningMask(word);
    const first = await completeRound(ctx, [{ signer: ctx.signers[1], mask: exactScoreMask(winner, 14) }], word);
    const second = await completeRound(ctx, [{ signer: ctx.signers[1], mask: winner }, { signer: ctx.signers[2], mask: winner }], word);
    await completeRound(ctx, [{ signer: ctx.signers[2], mask: exactScoreMask(winner, 14) }], word);
    for (const [round, offset] of [[second, 1], [first, 0], [second, 0]]) { await (await ctx.lottery.connect(round.winners[offset].signer).claim(round.id, offset)).wait(); ctx.accounting.claim(round.perWinner); await assertAccounting(ctx, (await ctx.lottery.rounds(await ctx.lottery.currentRoundId())).weeklyPool); }
    await assert.rejects(ctx.lottery.connect(ctx.signers[1]).claim(first.id, 0));
  });
});

