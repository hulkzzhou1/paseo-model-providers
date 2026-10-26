import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const code = ts.transpileModule(await readFile(new URL('./providers-state.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { filterSuppliers } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const supplier = { id: 'team-gateway', name: '团队网关', baseUrl: 'https://models.example.com/v2', models: ['friendly'], modelMappings: { friendly: 'gateway/private-v3' }, agents: ['codex'], enabled: true, hasKey: true };
const disabled = { ...supplier, id: 'offline', name: 'Offline', models: ['small'], modelMappings: undefined, agents: ['pi'], enabled: false };
const records = [supplier, disabled], before = structuredClone(records);
assert.deepEqual(filterSuppliers(records, '', 'all'), records);
assert.deepEqual(filterSuppliers(records, '  FRIENDLY ', 'all'), [supplier], 'Search trims whitespace and ignores case');
for (const search of ['团队', 'team-gateway', '/v2', 'models.example.com', 'gateway/private-v3', 'codex']) {
  assert(filterSuppliers(records, search, 'all').includes(supplier), 'Search matches provider, URL, alias, API ID and agent: ' + search);
}
assert.deepEqual(filterSuppliers(records, '', 'enabled'), [supplier]);
assert.deepEqual(filterSuppliers(records, '', 'disabled'), [disabled]);
assert.deepEqual(filterSuppliers(records, 'small', 'enabled'), [], 'Search respects the status filter');
assert.deepEqual(filterSuppliers(records, 'no-match', 'all'), []);
assert.deepEqual(filterSuppliers([], '', 'all'), []);
assert.deepEqual(records, before, 'Filtering never rewrites saved settings');
console.log('PASS: provider search, mapped API IDs, combined status filters and immutable records');
