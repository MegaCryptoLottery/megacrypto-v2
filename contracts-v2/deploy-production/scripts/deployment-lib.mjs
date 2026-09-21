import crypto from 'node:crypto';
import fs from 'node:fs';
import { ethers } from 'ethers';

export const REVIEWED = Object.freeze({
  source: 'dcf7b58db6ad8c4d2e0640e85437bd6cab8ea64d6aa24a1469964d06d6f2e564',
  abi: '0199f62a2caa3712a0ea04fe939a7c6921076f3959b23db942a7352135070fb2',
  creation: '5182efc9d03fc2ce2452fbf22bad398e42a0eb4f64b2ed33d462c033cc5853cf',
  runtime: '9166c142313b2eebc9b0d24cf1361a1505e77206aea6d59a00002490a4a12199'
});
export const PROFILES = Object.freeze({
  POLYGON: { chainId: 137n, name: 'Polygon', explorer: 'https://polygonscan.com/' },
  BNB: { chainId: 56n, name: 'BNB Chain', explorer: 'https://bscscan.com/' },
  ARBITRUM: { chainId: 42161n, name: 'Arbitrum One', explorer: 'https://arbiscan.io/' },
  BASE: { chainId: 8453n, name: 'Base', explorer: 'https://basescan.org/' },
  OPTIMISM: { chainId: 10n, name: 'Optimism', explorer: 'https://optimistic.etherscan.io/' },
  AVALANCHE: { chainId: 43114n, name: 'Avalanche C-Chain', explorer: 'https://snowtrace.io/' }
});
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isPlaceholder = (value) => typeof value !== 'string' || value.includes('REQUIRES_CURRENT_OFFICIAL_VERIFICATION') || value.includes('PENDING_') || value.trim() === '';
const asBigInt = (value, name, errors) => { try { if (isPlaceholder(String(value))) throw new Error(); return BigInt(value); } catch { errors.push(`${name} must be a supplied integer`); return 0n; } };
const address = (value, name, errors) => { if (isPlaceholder(value) || !ethers.isAddress(value) || value.toLowerCase() === ethers.ZeroAddress) errors.push(`${name} must be a non-zero address`); return value; };
const nonZeroBytes32 = (value, name, errors) => { if (isPlaceholder(value) || !ethers.isHexString(value, 32) || value === ethers.ZeroHash) errors.push(`${name} must be a non-zero bytes32`); return value; };

export function candidateArtifact() {
  const artifacts = JSON.parse(fs.readFileSync(new URL('../../artifacts/production-candidate.json', import.meta.url), 'utf8'));
  return artifacts['MegaCryptoLotteryV2ProductionCandidate.sol'].MegaCryptoLotteryV2ProductionCandidate;
}

export function verifyReviewedArtifact() {
  const artifact = candidateArtifact();
  const values = {
    source: hash(fs.readFileSync(new URL('../../contracts-production/MegaCryptoLotteryV2ProductionCandidate.sol', import.meta.url))),
    abi: hash(JSON.stringify(artifact.abi)),
    creation: hash(Buffer.from(artifact.evm.bytecode.object, 'hex')),
    runtime: hash(Buffer.from(artifact.evm.deployedBytecode.object, 'hex'))
  };
  return { values, matches: Object.entries(REVIEWED).every(([key, value]) => values[key] === value), creationBytes: artifact.evm.bytecode.object.length / 2, runtimeBytes: artifact.evm.deployedBytecode.object.length / 2 };
}

export function validateFields(config) {
  const errors = [];
  const profile = PROFILES[config.profile];
  if (!profile) errors.push('profile must be one of POLYGON, BNB, ARBITRUM, BASE, OPTIMISM, AVALANCHE');
  const paymentToken = address(config.paymentToken, 'PAYMENT_TOKEN', errors);
  const maintenanceWallet = address(config.maintenanceWallet, 'MAINTENANCE_WALLET', errors);
  const oracleWallet = address(config.oracleWallet, 'ORACLE_WALLET', errors);
  const emergencyAuthority = address(config.emergencyAuthority, 'EMERGENCY_AUTHORITY', errors);
  const coordinator = address(config.vrf?.coordinator, 'VRF_COORDINATOR', errors);
  const decimals = asBigInt(config.tokenDecimals, 'TOKEN_DECIMALS', errors);
  const ticketPrice = config.ticketPrice === 'AUTO_5_UNITS' ? 5n * 10n ** decimals : asBigInt(config.ticketPrice, 'TICKET_PRICE', errors);
  const roundDuration = asBigInt(config.roundDuration, 'ROUND_DURATION', errors);
  const jackpotBps = asBigInt(config.jackpotBps, 'JACKPOT_BPS', errors);
  const weeklyBps = asBigInt(config.weeklyBps, 'WEEKLY_BPS', errors);
  const maintenanceBps = asBigInt(config.maintenanceBps, 'MAINTENANCE_BPS', errors);
  const oracleBps = asBigInt(config.oracleBps, 'ORACLE_BPS', errors);
  const subscriptionId = asBigInt(config.vrf?.subscriptionId, 'VRF_SUBSCRIPTION_ID', errors);
  const callbackGasLimit = asBigInt(config.vrf?.callbackGasLimit, 'VRF_CALLBACK_GAS_LIMIT', errors);
  const confirmations = asBigInt(config.vrf?.requestConfirmations, 'VRF_REQUEST_CONFIRMATIONS', errors);
  const numWords = asBigInt(config.vrf?.numWords, 'VRF_NUM_WORDS', errors);
  const keyHash = nonZeroBytes32(config.vrf?.keyHash, 'VRF_KEY_HASH', errors);
  if (decimals > 255n) errors.push('TOKEN_DECIMALS must fit uint8');
  if (ticketPrice <= 0n) errors.push('TICKET_PRICE must be greater than zero');
  if (roundDuration < 86400n) errors.push('ROUND_DURATION must be at least 86400 seconds');
  if (jackpotBps + weeklyBps + maintenanceBps + oracleBps !== 10000n) errors.push('BPS total must equal exactly 10000');
  if (subscriptionId <= 0n) errors.push('VRF_SUBSCRIPTION_ID must be greater than zero');
  if (callbackGasLimit <= 0n || callbackGasLimit > 4294967295n) errors.push('VRF_CALLBACK_GAS_LIMIT must fit uint32 and be greater than zero');
  if (confirmations <= 0n || confirmations > 65535n) errors.push('VRF_REQUEST_CONFIRMATIONS must fit uint16 and be greater than zero');
  if (numWords <= 0n || numWords > 4294967295n) errors.push('VRF_NUM_WORDS must fit uint32 and be greater than zero');
  if (typeof config.vrf?.payWithNative !== 'boolean') errors.push('VRF_PAY_WITH_NATIVE must be true or false');
  return { errors, profile, values: { paymentToken, maintenanceWallet, oracleWallet, emergencyAuthority, coordinator, decimals, ticketPrice, roundDuration, jackpotBps, weeklyBps, maintenanceBps, oracleBps, subscriptionId, callbackGasLimit, confirmations, numWords, keyHash } };
}

export async function validateDeployment(config, readOnly) {
  const base = validateFields(config); const errors = [...base.errors];
  if (!base.profile) return { ...base, errors, ready: false };
  const network = await readOnly.network();
  if (BigInt(network.chainId) !== base.profile.chainId) errors.push(`Connected chainId ${network.chainId} does not match ${base.profile.chainId}`);
  if (base.errors.length === 0) {
    const [tokenCode, coordinatorCode, tokenDecimals] = await Promise.all([readOnly.code(base.values.paymentToken), readOnly.code(base.values.coordinator), readOnly.decimals(base.values.paymentToken)]);
    if (tokenCode === '0x') errors.push('PAYMENT_TOKEN contains no bytecode');
    if (coordinatorCode === '0x') errors.push('VRF_COORDINATOR contains no bytecode');
    if (BigInt(tokenDecimals) !== base.values.decimals) errors.push(`TOKEN_DECIMALS mismatch: configured ${base.values.decimals}, on-chain ${tokenDecimals}`);
  }
  const artifact = verifyReviewedArtifact();
  if (!artifact.matches) errors.push('Reviewed artifact identity does not match');
  if (artifact.runtimeBytes >= 24576) errors.push('Runtime bytecode exceeds EIP-170 limit');
  let constructorData = null;
  if (errors.length === 0) {
    const a = candidateArtifact();
    const factory = new ethers.ContractFactory(a.abi, a.evm.bytecode.object);
    const v = base.values;
    constructorData = (await factory.getDeployTransaction(v.paymentToken, Number(v.decimals), { ticketPrice: v.ticketPrice, roundDuration: v.roundDuration, jackpotBps: v.jackpotBps, weeklyBps: v.weeklyBps, maintenanceBps: v.maintenanceBps, oracleBps: v.oracleBps, maintenanceWallet: v.maintenanceWallet, oracleWallet: v.oracleWallet }, { coordinator: v.coordinator, subscriptionId: v.subscriptionId, keyHash: v.keyHash, callbackGasLimit: Number(v.callbackGasLimit), requestConfirmations: Number(v.confirmations), numWords: Number(v.numWords), payWithNative: config.vrf.payWithNative }, v.emergencyAuthority)).data;
  }
  return { ...base, errors, ready: errors.length === 0, artifact, constructorData };
}

export const stringify = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
