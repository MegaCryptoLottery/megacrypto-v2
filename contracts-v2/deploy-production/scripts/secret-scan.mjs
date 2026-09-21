import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('../..');
const ignored = new Set(['.git', 'node_modules', 'dist', 'artifacts', '.slither-venv', '.npm-cache']);
const patterns = [
  ['PRIVATE_KEY assignment', /(?:PRIVATE_KEY|PRIVATEKEY)\s*[=:]\s*[^\s"']+/i],
  ['MNEMONIC assignment', /(?:MNEMONIC|SEED_PHRASE)\s*[=:]\s*[^\s"']+/i],
  ['private-key PEM', /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/],
  ['AWS access key', /AKIA[0-9A-Z]{16}/]
];
const findings = [];
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.size < 1_000_000) {
      const text = fs.readFileSync(file, 'utf8');
      for (const [label, pattern] of patterns) if (pattern.test(text)) findings.push({ file: path.relative(root, file).replaceAll('\\', '/'), pattern: label });
    }
  }
};
visit(root);
console.log(JSON.stringify({ status: findings.length ? 'SECRET_REMEDIATION_REQUIRED' : 'PASS', findings }, null, 2));
if (findings.length) process.exitCode = 1;
