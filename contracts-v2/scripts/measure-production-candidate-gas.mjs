import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';
import { artifact, advance, ticketMask } from '../test/helpers.mjs';

const compiled = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8'));
const candidate = compiled['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
const coordinatorArtifact = compiled['mocks/OfficialVrfCoordinatorMock.sol'].OfficialVrfCoordinatorMock;
const receiverArtifact = compiled['mocks/ValidMigrationReceiver.sol'].ValidMigrationReceiver;
const DAY = 24 * 60 * 60;
const value = (receipt) => Number(receipt.gasUsed);

async function fixture() {
  const raw = ganache.provider({ logging: { quiet: true }, miner: { blockGasLimit: 30_000_000 }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } });
  const provider = new ethers.BrowserProvider(raw);
  const owner = await provider.getSigner(0); const player = await provider.getSigner(1);
  const deploy = async (a, args = []) => { const x = await new ethers.ContractFactory(a.abi, a.evm.bytecode.object, owner).deploy(...args); await x.waitForDeployment(); return x; };
  const token = await deploy(artifact('mocks/MockERC20.sol', 'MockERC20'), [6]);
  const coordinator = await deploy(coordinatorArtifact);
  const config = { coordinator: await coordinator.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const economics = { ticketPrice: 5_000_000n, roundDuration: 7 * DAY, jackpotBps: 5000, weeklyBps: 3800, maintenanceBps: 600, oracleBps: 600, maintenanceWallet: await owner.getAddress(), oracleWallet: await owner.getAddress() };
  const lottery = await deploy(candidate, [await token.getAddress(), 6, economics, config, await owner.getAddress()]);
  await (await token.mint(await player.getAddress(), 10_000_000_000n)).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, player, token, coordinator, lottery, deploy, blockGasLimit: Number((await provider.getBlock('latest')).gasLimit) };
}
async function receipt(tx) { return tx.wait(); }
async function settleFixture(count) {
  const f = await fixture();
  for (let i = 0; i < count; i++) await receipt(await f.lottery.connect(f.player).buyTicket(ticketMask()));
  await advance(f.provider, 7 * DAY + 1); await receipt(await f.lottery.closeRound(1)); await receipt(await f.lottery.requestRandomness(1)); await receipt(await f.coordinator.fulfill(1, 44));
  const r = await receipt(await f.lottery.processSettlement(1, count, { gasLimit: 30_000_000n }));
  return { gas: value(r), blockGasLimit: f.blockGasLimit };
}

const f = await fixture(); const gas = {};
gas.buyTicket = value(await receipt(await f.lottery.connect(f.player).buyTicket(ticketMask())));
await advance(f.provider, 7 * DAY + 1);
gas.closeRound = value(await receipt(await f.lottery.closeRound(1)));
gas.requestRandomness = value(await receipt(await f.lottery.requestRandomness(1)));
gas.vrfFulfillment = value(await receipt(await f.coordinator.fulfill(1, 44)));
gas.processSettlement = value(await receipt(await f.lottery.processSettlement(1, 1)));
gas.claim = value(await receipt(await f.lottery.connect(f.player).claim(1, 0)));
gas.openNextRound = value(await receipt(await f.lottery.openNextRound()));

const m = await fixture(); await receipt(await m.lottery.connect(m.player).buyTicket(ticketMask())); await advance(m.provider, 7 * DAY + 1); await receipt(await m.lottery.closeRound(1)); await receipt(await m.lottery.requestRandomness(1)); await advance(m.provider, 3 * DAY + 1);
gas.manualContingency = value(await receipt(await m.lottery.executeManualContingency(1, 7, ethers.id('timeout'), ethers.id('evidence'), { gasLimit: 500000n })));
await receipt(await m.lottery.processSettlement(1, 1));
const receiver = await m.deploy(receiverArtifact);
gas.proposeMigration = value(await receipt(await m.lottery.proposeMigration(await receiver.getAddress())));
await advance(m.provider, 7 * DAY + 1);
gas.executeMigration = value(await receipt(await m.lottery.executeMigration()));

const settlement = {};
for (const count of [1, 10, 100, 200]) settlement[count] = await settleFixture(count);
const result = { harness: 'Ganache local EVM only', blockGasLimit: f.blockGasLimit, gas, settlement };
console.log(`PRODUCTION_CANDIDATE_GAS ${JSON.stringify(result)}`);
