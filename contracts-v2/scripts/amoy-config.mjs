import fs from 'node:fs';
import { ethers } from 'ethers';

export const AMOY = Object.freeze({
  chainId: 80002n,
  rpcUrl: 'https://rpc-amoy.polygon.technology/',
  explorer: 'https://amoy.polygonscan.com/',
  coordinator: '0x343300b5d84D444B2ADc9116FEF1bED02BE49Cf2',
  keyHash: '0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899',
  link: '0x0fd9e8d3af1aaee056eb9e802c3a762a667b1904',
  requestConfirmations: 3,
  callbackGasLimit: 500000,
  numWords: 1,
  payWithNative: true,
  subscriptionId: 'PENDING',
  usdtAddress: 'PENDING_DEPLOY_MOCK_USDT',
  ticketPrice: 'PENDING_OPERATIONAL_DECISION',
  roundDuration: 'PENDING_OPERATIONAL_DECISION',
  maintenanceWallet: 'PENDING_USER_ADDRESS',
  oracleWallet: 'PENDING_USER_ADDRESS',
  emergencyAuthority: 'PENDING_USER_ADDRESS'
});
export const preAdminFrozen = Object.freeze({ source: '7a0864029420637eaf8635da405ce70ccfbe08f4abf2d5d7f1751b2cb1745e24', abi: 'fb2631608e3aef666dfb2013035678a6aec562581dece30a44ee77b5f8c776f3', creation: '56b4a1a21d412f24ed7fa50295e08bb42fc3025b20fdcf18475cdddbad0d8a98', runtime: 'ed8eff46cf8fcf290ff95869fea064ef3fec3fb874523b2203e12388ad6373ff' });
export const postAdminCandidate = Object.freeze({ source: '7bfbf15b5a820d113699348734047d2b3d68182eb6c4e8a4f180047ff44a226a', abi: '0199f62a2caa3712a0ea04fe939a7c6921076f3959b23db942a7352135070fb2', creation: 'e616919ed89737c3415b87a15dc48f76e2a98b5037b4ea576d58db9b2be8ba4d', runtime: '9406689bc180e8f7de81d6391a0670c6ed65c461b5c76aa58e7180bd0177ac13' });
export function candidateArtifact() { const a = JSON.parse(fs.readFileSync(new URL('../artifacts/production-candidate.json', import.meta.url), 'utf8')); return a['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate; }
export function mockArtifact() { const a = JSON.parse(fs.readFileSync(new URL('../artifacts/amoy-testnet.json', import.meta.url), 'utf8')); return a['contracts-testnet/MockUSDT.sol'].MockUSDT; }
export function assertDryRun() { if (process.env.AMOY_BROADCAST === 'CONFIRM') throw new Error('This package intentionally has no signer or broadcast implementation. Use a wallet-controlled deployment process only after separate authorization.'); }
export const hash = (value) => ethers.sha256(typeof value === 'string' ? (value.startsWith('0x') ? value : ethers.toUtf8Bytes(value)) : value);
