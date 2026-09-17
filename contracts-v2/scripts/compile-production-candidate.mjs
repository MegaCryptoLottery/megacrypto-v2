import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';

const root = path.resolve('contracts-production');
const entry = path.join(root, 'MegaCryptoLotteryV2ProductionCandidate.sol');
const collect = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry_) => entry_.isDirectory() ? collect(path.join(dir, entry_.name)) : entry_.name.endsWith('.sol') ? [path.join(dir, entry_.name)] : []);
const resolveImport = (specifier) => {
  const file = specifier.startsWith('@')
    ? path.resolve('node_modules', specifier)
    : path.resolve(root, specifier);
  return fs.existsSync(file) ? { contents: fs.readFileSync(file, 'utf8') } : { error: `Import not found: ${specifier}` };
};
const input = {
  language: 'Solidity',
  sources: Object.fromEntries(collect(root).map((file) => [path.relative(root, file).replaceAll('\\', '/'), { content: fs.readFileSync(file, 'utf8') }])),
  settings: {
    evmVersion: 'shanghai', viaIR: true, optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: resolveImport }));
for (const issue of output.errors ?? []) console.log(issue.formattedMessage);
if ((output.errors ?? []).some((issue) => issue.severity === 'error')) process.exit(1);
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/production-candidate.json', JSON.stringify(output.contracts, null, 2));
console.log(`Compiled official-import production candidate with solc ${solc.version()}`);

