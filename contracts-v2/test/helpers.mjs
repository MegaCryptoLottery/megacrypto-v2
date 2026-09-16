import fs from 'node:fs';
import { ethers } from 'ethers';
import ganache from 'ganache';

const artifacts = JSON.parse(fs.readFileSync(new URL('../artifacts/contracts.json', import.meta.url), 'utf8'));
export const artifact = (file, name) => artifacts[file][name];
export const ticketMask = (numbers = Array.from({ length: 15 }, (_, i) => i + 1)) => numbers.reduce((mask, n) => mask | (1 << (n - 1)), 0);
export const winningMask = (word) => {
  let mask = 0; let selected = 0; let nonce = 0;
  const coder = ethers.AbiCoder.defaultAbiCoder();
  while (selected < 15) { const n = Number(BigInt(ethers.keccak256(coder.encode(['uint256', 'uint256'], [word, nonce++]))) % 25n); const bit = 1 << n; if ((mask & bit) === 0) { mask |= bit; selected++; } }
  return mask;
};
export async function fixture(decimals = 6) {
  const provider = new ethers.BrowserProvider(ganache.provider({ logging: { quiet: true }, chain: { chainId: 31337, time: new Date('2026-01-01T00:00:00Z') } }));
  const owner = await provider.getSigner(0); const player = await provider.getSigner(1); const attacker = await provider.getSigner(2);
  const deploy = async (file, name, args = [], signer = owner) => new ethers.ContractFactory(artifact(file, name).abi, artifact(file, name).evm.bytecode.object, signer).deploy(...args);
  const token = await deploy('mocks/MockERC20.sol', 'MockERC20', [decimals]); await token.waitForDeployment();
  const vrf = await deploy('mocks/MockVrfCoordinator.sol', 'MockVrfCoordinator'); await vrf.waitForDeployment();
  const config = { coordinator: await vrf.getAddress(), subscriptionId: 1n, keyHash: ethers.ZeroHash, callbackGasLimit: 500000, requestConfirmations: 3, numWords: 1, payWithNative: true };
  const lottery = await deploy('MegaCryptoLotteryHardenedV2.sol', 'MegaCryptoLotteryHardenedV2', [await token.getAddress(), decimals, 7 * 24 * 60 * 60, 5n * 10n ** BigInt(decimals), config, await owner.getAddress()]); await lottery.waitForDeployment();
  await (await token.mint(await player.getAddress(), 1000000n * 10n ** BigInt(decimals))).wait();
  await (await token.connect(player).approve(await lottery.getAddress(), ethers.MaxUint256)).wait();
  return { provider, owner, player, attacker, token, vrf, lottery, deploy, decimals };
}
export const advance = async (provider, seconds) => { await provider.send('evm_increaseTime', [seconds]); await provider.send('evm_mine', []); };

