import { spawnSync } from 'node:child_process';
import path from 'node:path';

const mocha = process.execPath;
const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const run = (command, args) => { const result = spawnSync(command, args, { encoding: 'utf8' }); process.stdout.write(result.stdout ?? ''); process.stderr.write(result.stderr ?? ''); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status ?? 1); return result.stdout ?? ''; };
const started = Date.now();
run(process.execPath, [npmCli, 'run', 'compile']);
run(process.execPath, [npmCli, 'run', 'compile:production']);
const totals = { tickets: 0, comparisons: 0 };
for (let shard = 0; shard < 10; shard++) { const output = run(mocha, ['node_modules/mocha/bin/mocha.js', '--timeout', '180000', 'test/production-candidate.multiround.test.mjs', '--', '--shard', String(shard)]); const match = output.match(/MULTIROUND_SHARD_STATS .*tickets=(\d+) accountingComparisons=(\d+)/); if (!match) throw new Error(`Missing shard statistics for shard ${shard}`); totals.tickets += Number(match[1]); totals.comparisons += Number(match[2]); }
run(mocha, ['node_modules/mocha/bin/mocha.js', '--timeout', '180000', 'test/production-candidate.multiround.test.mjs', '--', '--matrices-only']);
console.log(`MULTIROUND_TOTAL_STATS shardsCompleted=10 campaigns=100 rounds=500 tickets=${totals.tickets} accountingComparisons=${totals.comparisons} 6DecimalCampaigns=50 18DecimalCampaigns=50 elapsedMs=${Date.now() - started}`);

