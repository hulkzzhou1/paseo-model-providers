import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const dataUrl = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const limitsUrl = dataUrl(compile(await readFile(new URL('./token-limits.ts',import.meta.url),'utf8')));
const code = compile(await readFile(new URL('./model-form-state.ts', import.meta.url), 'utf8')).replace('"./token-limits"',JSON.stringify(limitsUrl));
const { mergeModelRows, newModelRow, maxModelRows, supplierModelRows } = await import(dataUrl(code));
const model = id => ({id, name:id});

assert.deepEqual(mergeModelRows([{key:0,id:'',apiId:''}], [model('a'),model('b')]), {
  rows:[{key:0,id:'a',apiId:'a'},{key:1,id:'b',apiId:'b'}],omitted:0,
});
const manual = [{key:4,id:'friendly-alias',apiId:'gateway/actual'}, {key:8,id:'manual-model',apiId:''}];
const original = structuredClone(manual);
const result = mergeModelRows(manual, [model('gateway/actual'),model('friendly-alias'),model('new-model'),model('new-model')]);
assert.deepEqual(result.rows, [...manual,{key:9,id:'new-model',apiId:'new-model'}]);
assert.deepEqual(manual,original,'Loading must not mutate manual rows');
assert.deepEqual(mergeModelRows(result.rows,[model('new-model')]).rows,result.rows,'Repeated loads must not duplicate rows');
assert.deepEqual(mergeModelRows(manual,[]),{rows:manual,omitted:0},'Empty catalogs must preserve drafts');
assert.deepEqual(newModelRow(manual),{key:9,id:'',apiId:''});
const partial = [{key:0,id:'',apiId:'partial-request-id'}];
assert.deepEqual(mergeModelRows(partial,[model('another')]).rows[0],partial[0],'Partially entered rows must survive loading');
const limited = mergeModelRows([],Array.from({length:maxModelRows+3},(_,i)=>model('model-'+i)));
assert.equal(limited.rows.length,maxModelRows);assert.equal(limited.omitted,3);
console.log('PASS: automatic model form filling, mapping preservation, stable row keys, deduplication and row limits');

const catalogMetadata=[{id:'large',name:'Large',contextWindow:1000000,maxTokens:64000},{id:'small',name:'Small',contextWindow:128000,maxTokens:16000}];
const capacities=mergeModelRows([],catalogMetadata);
assert.equal(capacities.rows[0].contextWindow,'1M');assert.equal(capacities.rows[1].contextWindow,'128K');
assert.equal(capacities.rows[0].maxTokens,'64K');assert.equal(capacities.rows[1].maxTokens,'16K');
const customized=[{key:0,id:'alias',apiId:'actual',contextWindow:'256K',maxTokens:'32K'}];
assert.deepEqual(mergeModelRows(customized,[{id:'actual',name:'Actual',contextWindow:1000000,maxTokens:64000}]).rows,customized,'Explicit limits must survive refresh');
const inherited=[{key:0,id:'alias',apiId:'actual'}];
assert.equal(mergeModelRows(inherited,[{id:'actual',name:'Actual',contextWindow:1000000}]).rows[0].contextWindow,'1M');
assert.equal(inherited[0].contextWindow,undefined,'Metadata filling must not mutate the draft');
for (const catalog of [catalogMetadata, [...catalogMetadata].reverse()]) {
 const mapped=mergeModelRows([{key:0,id:'large',apiId:'small'}],catalog).rows[0];
 assert.equal(mapped.contextWindow,'128K','Mapped capacities must follow the actual request ID regardless of catalog order');
 assert.equal(mapped.maxTokens,'16K');
 const customized=mergeModelRows([{key:0,id:'large',apiId:'small',maxTokens:'32K'}],catalog).rows[0];
 assert.equal(customized.contextWindow,'128K');assert.equal(customized.maxTokens,'32K');
}
assert.equal(mergeModelRows([{key:0,id:'large',apiId:'unlisted'}],catalogMetadata).rows[0].contextWindow,undefined,'Missing API models must not inherit alias metadata');
const sizeOnly=[{key:0,id:'',apiId:'',contextWindow:'128K'}];
assert.deepEqual(mergeModelRows(sizeOnly,[model('other')]).rows[0],sizeOnly[0],'Capacity-only drafts must survive loading');
assert.deepEqual(supplierModelRows({models:['alias'],modelMappings:{alias:'actual'},modelLimits:{alias:{contextWindow:1048576,maxTokens:393216}}}),[{key:0,id:'alias',apiId:'actual',contextWindow:'1048576',maxTokens:'393216'}]);
console.log('PASS: per-model catalog limits, manual override preservation and mapped model capacity restoration');
