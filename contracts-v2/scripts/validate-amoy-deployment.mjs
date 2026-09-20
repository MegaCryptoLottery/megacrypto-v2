import { ethers } from 'ethers';
import { AMOY, candidateArtifact, hash, postAdminCandidate, preAdminFrozen } from './amoy-config.mjs';

const address = process.env.AMOY_LOTTERY_ADDRESS;
if (!address) { console.log(JSON.stringify({ mode: 'DRY_RUN_READ_ONLY', required: ['AMOY_LOTTERY_ADDRESS', 'AMOY_MOCK_USDT_ADDRESS', 'AMOY_SUBSCRIPTION_ID', 'AMOY_MAINTENANCE_WALLET', 'AMOY_ORACLE_WALLET', 'AMOY_EMERGENCY_AUTHORITY'], expected: AMOY, preAdminFrozenHashes: preAdminFrozen, postAdminCandidateHashes: postAdminCandidate }, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2)); process.exit(0); }
const provider = new ethers.JsonRpcProvider(process.env.AMOY_RPC_URL || AMOY.rpcUrl);
const network = await provider.getNetwork(); if (network.chainId !== AMOY.chainId) throw new Error(`Expected chainId ${AMOY.chainId}, received ${network.chainId}`);
const bytecode = await provider.getCode(address); if (bytecode === '0x') throw new Error('No lottery bytecode at AMOY_LOTTERY_ADDRESS');
const c = new ethers.Contract(address, candidateArtifact().abi, provider);
const [token, decimals, owner, emergency, config, roundId, round, solvency] = await Promise.all([c.usdt(), c.usdtDecimals(), c.owner(), c.emergencyAuthority(), c.vrfConfig(1), c.currentRoundId(), c.rounds(1), c.solvency()]);
const result = { mode: 'READ_ONLY', chainId: network.chainId.toString(), lottery: address, bytecodeBytes: (bytecode.length - 2) / 2, token, decimals: decimals.toString(), owner, emergencyAuthority: emergency, vrfConfig: { coordinator: config.coordinator, subscriptionId: config.subscriptionId.toString(), keyHash: config.keyHash, requestConfirmations: config.requestConfirmations.toString(), callbackGasLimit: config.callbackGasLimit.toString(), numWords: config.numWords.toString(), payWithNative: config.payWithNative }, currentRoundId: roundId.toString(), round, solvency, runtimeHash: hash(bytecode), postAdminCandidateHashes: postAdminCandidate, preAdminFrozenHashes: preAdminFrozen, note: 'Runtime hash differs after deployment because immutable constructor values are embedded; compare code existence, ABI-visible immutable values, and deployment input instead.' };
console.log(JSON.stringify(result, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2));
