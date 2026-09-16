import fs from 'node:fs';
const source = fs.readFileSync('contracts/MegaCryptoLotteryHardenedV2.sol', 'utf8');
const required = ['requestIdToRoundId', 'processSettlement', 'nonReentrant', 'MIGRATION_DELAY', 'MIGRATED_CLAIMS_ONLY', 'block.timestamp < r.cutoffAt'];
for (const token of required) if (!source.includes(token)) throw new Error(`Missing hardening control: ${token}`);
if (source.includes('tx.origin') || source.includes('.transfer(')) throw new Error('Unsafe primitive detected');
console.log('Static policy scan passed: required controls present; tx.origin and native transfer absent.');

