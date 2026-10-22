import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const module = ts.transpileModule(await readFile(new URL('./token-limits.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { parseTokenCount, formatTokenCount } = await import('data:text/javascript;base64,' + Buffer.from(module.outputText).toString('base64'));

for (const [input, expected] of [
  ['256K', 256000], ['1M', 1000000], ['128k', 128000], ['1.5m', 1500000],
  [' 16 K ', 16000], ['32768', 32768], ['4096', 4096], ['1.001K', 1001], ['0', 0],
]) assert.equal(parseTokenCount(input), expected, input);

for (const input of ['', ' ', 'K', '1.', '-16K', '1e3', 'Infinity', '256KB', 'NaN', '1,000', '1.1', '0.0001K', '9007199254740992']) {
  assert(Number.isNaN(parseTokenCount(input)), input);
}

assert.equal(formatTokenCount(256000), '256K');
assert.equal(formatTokenCount(1000000), '1M');
for (const value of [32, 1024, 4096, 32768, 100000, 256000, 1048576, 1500000, 2000000]) {
  assert.equal(parseTokenCount(formatTokenCount(value)), value, 'Editing must preserve the exact saved limit');
}
console.log('PASS: K/M token input, invalid values and exact limit preservation');
