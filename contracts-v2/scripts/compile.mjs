import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const root = path.resolve('contracts');
const collect = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? collect(path.join(dir, entry.name)) : entry.name.endsWith('.sol') ? [path.join(dir, entry.name)] : []);
const sources = Object.fromEntries(collect(root).map((file) => [path.relative(root, file).replaceAll('\\', '/'), { content: fs.readFileSync(file, 'utf8') }]));
const output = JSON.parse(solc.compile(JSON.stringify({ language: 'Solidity', sources, settings: { evmVersion: 'shanghai', viaIR: true, optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } } })));
const errors = (output.errors ?? []).filter((error) => error.severity === 'error');
for (const issue of output.errors ?? []) console.log(issue.formattedMessage);
if (errors.length) process.exit(1);
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/contracts.json', JSON.stringify(output.contracts, null, 2));
console.log(`Compiled ${Object.values(output.contracts).flatMap(Object.values).length} contracts with solc ${solc.version()}`);

