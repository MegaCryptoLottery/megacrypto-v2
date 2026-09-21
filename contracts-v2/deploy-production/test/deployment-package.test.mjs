import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PROFILES, REVIEWED, validateDeployment, verifyReviewedArtifact } from '../scripts/deployment-lib.mjs';

const token = '0x0000000000000000000000000000000000000011';
const coordinator = '0x0000000000000000000000000000000000000022';
const wallet = '0x0000000000000000000000000000000000000033';
const base = (profile = 'POLYGON') => ({ profile, paymentToken: token, tokenDecimals: '6', tokenLabel: 'USDT', ticketPrice: 'AUTO_5_UNITS', roundDuration: '86400', jackpotBps: '5000', weeklyBps: '3800', maintenanceBps: '600', oracleBps: '600', maintenanceWallet: wallet, oracleWallet: wallet, emergencyAuthority: wallet, vrf: { coordinator, subscriptionId: '1', keyHash: '0x' + '11'.repeat(32), callbackGasLimit: '500000', requestConfirmations: '3', numWords: '1', payWithNative: true } });
const reader = (chainId = 137n, options = {}) => ({ network: async () => ({ chainId }), code: async (value) => options.noCode === value ? '0x' : '0x1234', decimals: async () => options.decimals ?? 6n });

describe('production deployment package', () => {
  it('reproduces the reviewed candidate identity and supports all six isolated profiles', () => {
    const artifact = verifyReviewedArtifact();
    assert.equal(artifact.matches, true);
    assert.deepEqual(Object.values(PROFILES).map((profile) => profile.chainId), [137n, 56n, 42161n, 8453n, 10n, 43114n]);
    assert.equal(REVIEWED.source, artifact.values.source);
  });
  it('accepts a valid profile, same operational wallet, and constructor encoding without broadcasting', async () => {
    const result = await validateDeployment(base(), reader());
    assert.equal(result.ready, true);
    assert.ok(result.constructorData.startsWith('0x'));
    assert.equal(result.values.ticketPrice, 5_000_000n);
  });
  it('rejects wrong chain, missing code, and decimal mismatch', async () => {
    assert.equal((await validateDeployment(base(), reader(56n))).ready, false);
    assert.equal((await validateDeployment(base(), reader(137n, { noCode: token }))).ready, false);
    assert.equal((await validateDeployment(base(), reader(137n, { decimals: 18n }))).ready, false);
  });
  it('rejects all critical local parameters without needing RPC credentials', async () => {
    const cases = [
      ['paymentToken', '0x0000000000000000000000000000000000000000'], ['ticketPrice', '0'], ['roundDuration', '86399'], ['jackpotBps', '5001'], ['maintenanceWallet', '0x0000000000000000000000000000000000000000'], ['oracleWallet', '0x0000000000000000000000000000000000000000'], ['emergencyAuthority', '0x0000000000000000000000000000000000000000']
    ];
    for (const [key, value] of cases) { const config = base(); config[key] = value; assert.equal((await validateDeployment(config, reader())).ready, false, key); }
    for (const [key, value] of [['coordinator', '0x0000000000000000000000000000000000000000'], ['subscriptionId', '0'], ['keyHash', '0x' + '00'.repeat(32)], ['callbackGasLimit', '0'], ['requestConfirmations', '0'], ['numWords', '0']]) { const config = base(); config.vrf[key] = value; assert.equal((await validateDeployment(config, reader())).ready, false, `vrf.${key}`); }
  });
  it('does not allow configuration to leak between profiles', async () => {
    const polygon = base('POLYGON'); const avalanche = base('AVALANCHE');
    assert.equal((await validateDeployment(polygon, reader(137n))).ready, true);
    assert.equal((await validateDeployment(avalanche, reader(43114n))).ready, true);
    assert.equal((await validateDeployment(polygon, reader(43114n))).ready, false);
  });
  it('keeps dry run read-only and does not require a private key', () => {
    const source = fs.readFileSync(new URL('../scripts/dry-run.mjs', import.meta.url), 'utf8');
    assert.equal(source.includes('sendTransaction'), false);
    assert.equal(source.includes('new ethers.Wallet'), false);
    assert.equal(source.includes('signTransaction'), false);
  });
});
