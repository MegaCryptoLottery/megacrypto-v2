import fs from 'node:fs';
import solc from 'solc';

const source = 'contracts-testnet/MockUSDT.sol';
const input = { language: 'Solidity', sources: { [source]: { content: fs.readFileSync(source, 'utf8') } }, settings: { evmVersion: 'shanghai', optimizer: { enabled: true, runs: 200 }, outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const issue of output.errors ?? []) console.log(issue.formattedMessage);
if ((output.errors ?? []).some((issue) => issue.severity === 'error')) process.exit(1);
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/amoy-testnet.json', JSON.stringify(output.contracts, null, 2));
console.log(`Compiled TESTNET ONLY MockUSDT with solc ${solc.version()}`);

