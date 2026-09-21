import fs from 'node:fs';
import { ethers } from 'ethers';
import { stringify, validateDeployment } from './deployment-lib.mjs';

const index = process.argv.indexOf('--config');
if (index < 0 || !process.argv[index + 1]) throw new Error('Usage: node scripts/dry-run.mjs --config config/polygon.json --rpc https://...');
const rpcIndex = process.argv.indexOf('--rpc');
if (rpcIndex < 0 || !process.argv[rpcIndex + 1]) throw new Error('Dry run requires an explicit read-only --rpc URL; no provider credentials are stored.');
const config = JSON.parse(fs.readFileSync(process.argv[index + 1], 'utf8'));
const provider = new ethers.JsonRpcProvider(process.argv[rpcIndex + 1]);
const result = await validateDeployment(config, { network: () => provider.getNetwork(), code: (value) => provider.getCode(value), decimals: async (value) => new ethers.Contract(value, ['function decimals() view returns (uint8)'], provider).decimals() });
let deploymentGas = null;
if (result.ready) { try { deploymentGas = await provider.estimateGas({ data: result.constructorData }); } catch { deploymentGas = 'UNAVAILABLE_FROM_RPC'; } }
console.log(stringify({ mode: 'DRY_RUN_READ_ONLY_NO_SIGNING_NO_BROADCAST', status: result.ready ? 'READY_TO_PREPARE_DEPLOYMENT' : 'BLOCKED_VALIDATION_FAILED', network: result.profile, errors: result.errors, userSelectedParameters: { paymentToken: config.paymentToken, tokenDecimals: config.tokenDecimals, ticketPrice: result.values.ticketPrice, roundDuration: config.roundDuration, jackpotBps: config.jackpotBps, weeklyBps: config.weeklyBps, maintenanceBps: config.maintenanceBps, oracleBps: config.oracleBps, maintenanceWallet: config.maintenanceWallet, oracleWallet: config.oracleWallet, emergencyAuthority: config.emergencyAuthority }, networkInfrastructureParameters: config.vrf, coordinatorImmutableConfirmation: 'VRF coordinator is constructor-bound and cannot be replaced in place.', artifact: result.artifact, estimatedDeploymentGas: deploymentGas, constructorData: result.constructorData, transactionsBroadcast: 0, walletSignatures: 0, fundsMoved: 0 }));
