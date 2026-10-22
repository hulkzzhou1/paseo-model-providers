import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, symlink, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const temp = await mkdtemp(join(tmpdir(), 'paseo-model-providers-test-'));
const originalHome = process.env.PASEO_HOME;
const originalFetch = globalThis.fetch;
process.env.PASEO_HOME = join(temp,'home');
// Paseo config.patch merges objects recursively; arrays and scalar values replace.
function mergeConfig(current, patch) {
 const merged={...current};
 const isRecord=value=>value!==null && typeof value==='object' && !Array.isArray(value);
 for(const [key,value] of Object.entries(patch)) {
  if(value===undefined)continue;
  merged[key]=isRecord(merged[key]) && isRecord(value) ? mergeConfig(merged[key],value) : value;
 }
 return merged;
}
async function compile(file) {
 const source = await readFile(file,'utf8');
 const target = join(temp, file.replace(/\.ts$/,'.js'));
 await mkdir(resolve(target,'..'),{recursive:true});
 await writeFile(target,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
try {
 await symlink(resolve('node_modules'),join(temp,'node_modules'));
 for (const file of ['index.server.ts','shared/contracts.ts','shared/presets.ts','server/adapters.ts','server/store.ts','server/probe.ts','server/endpoints.ts','server/models.ts','server/agent-extension.ts']) await compile(file);
 const require=createRequire(join(temp,'entry.cjs'));
 const {supplierSchema,compatible,aliasId,requestModelId,modelId,stateRpc,saveRpc,probeRpc,discoverRpc}=require(join(temp,'shared/contracts.js'));
 const {supplierPresets}=require(join(temp,'shared/presets.js'));
 const {buildAlias}=require(join(temp,'server/adapters.js'));
 const {parseModels,discoverModels}=require(join(temp,'server/models.js'));
 const {probe,probeRequest}=require(join(temp,'server/probe.js'));
 const {readStore}=require(join(temp,'server/store.js'));
 const supplier={id:'example',name:'Example',protocol:'anthropic',anthropicAuth:'api-key',baseUrl:'https://example.com',models:['sample-model'],agents:['claude'],enabled:true,contextWindow:32768,maxTokens:1024,key:'test-only-secret'};
 assert.equal(supplierSchema.safeParse({...supplier,baseUrl:'https://user:pass@example.com'}).success,false);
 assert.equal(supplierSchema.safeParse({...supplier,id:'../overwrite'}).success,false);
 assert.equal(supplierSchema.safeParse({...supplier,baseUrl:'not-a-url'}).success,false);
 const retired={catalogUrl:'https://other.example.com/config',requestHeaders:[{name:'X-Retired',value:'removed'}]};
 const clean=supplierSchema.parse({...supplier,...retired});
 assert.equal(Object.hasOwn(clean,'catalogUrl'),false);
 assert.equal(Object.hasOwn(clean,'requestHeaders'),false);
 assert.equal(Object.hasOwn(discoverRpc.input.parse({...supplier,...retired}),'catalogUrl'),false);

 assert.equal(supplierSchema.safeParse({...supplier,models:['duplicate','duplicate']}).success,false);
 assert.equal(supplierSchema.safeParse({...supplier,modelMappings:{'sample-model':'invalid id'}}).success,false);
 assert.equal(supplierSchema.safeParse({...supplier,modelMappings:{'sample-model':''}}).success,false);
 assert.equal(supplierSchema.safeParse({...supplier,modelMappings:{'invalid alias':'actual'}}).success,false);
 const deepseek=supplierSchema.parse(supplierPresets.deepseek);
 assert.equal(deepseek.contextWindow,1048576);assert.equal(deepseek.maxTokens,393216);
 assert(deepseek.agents.every(engine=>compatible(deepseek.protocol,engine)));
 const customDeepseek={...deepseek,key:'test-only-key',baseUrl:'https://gateway.example.com/custom/v1'};
 assert.equal(supplierSchema.parse(customDeepseek).baseUrl,customDeepseek.baseUrl);
 assert.equal(JSON.parse(buildAlias(customDeepseek,'opencode','').env.OPENCODE_CONFIG_CONTENT).provider['mp-deepseek-opencode'].options.baseURL,customDeepseek.baseUrl);
 assert.equal(compatible('chat-completions','codex'),false);
 assert.equal(compatible('responses','claude'),false);
 for(const [engine,protocol] of [['claude','anthropic'],['codex','responses'],['opencode','chat-completions'],['pi','responses'],['omp','anthropic']]) {
  const a=buildAlias({...supplier,protocol},engine,'/tmp/extension.mjs');
  assert.equal(a.extends,engine);assert.equal(a.models.length,1);
  assert.equal(a.enabled,true);
  const mapped={...supplier,protocol,modelMappings:{'sample-model':'gateway/actual-model'}};
  const adapter=buildAlias(mapped,engine,'/tmp/extension.mjs');
  assert.equal(requestModelId(mapped,'sample-model'),'gateway/actual-model');
  assert.equal(requestModelId(mapped,'unmapped'),'unmapped');
  assert.equal(adapter.models[0].id,modelId(mapped,engine,'sample-model'));
  assert(adapter.models[0].id.endsWith('gateway/actual-model'));
  assert.equal(adapter.models[0].label,'sample-model');
  if(engine==='opencode') {
   const config=JSON.parse(adapter.env.OPENCODE_CONFIG_CONTENT).provider[aliasId(supplier.id,engine)];
   assert.deepEqual(config.models,{'gateway/actual-model':{name:'sample-model'}});
  }
  if(engine==='pi'||engine==='omp') {
   const config=JSON.parse(adapter.env.PASEO_MODEL_CONFIG);
   assert.deepEqual(config.models,['gateway/actual-model']);
   assert.equal(config.modelLabels['gateway/actual-model'],'sample-model');
  }
 }

 const codex=buildAlias({...supplier,protocol:'responses'},'codex','');
 assert.equal(codex.env.OPENAI_BASE_URL,'');
 assert.equal(codex.command[2],'model_provider="mp-example-codex"');
 assert(codex.command[4].includes('base_url = "https://example.com/v1"'));
 assert.equal(codex.command[4].includes('http_headers'),false);
 for(const [engine,protocol] of [['claude','anthropic'],['codex','responses'],['opencode','chat-completions'],['pi','responses'],['omp','anthropic']]) {
  assert.equal(JSON.stringify(buildAlias({...supplier,...retired,protocol},engine,'/tmp/extension.mjs')).includes('X-Retired'),false);
 }
 assert.equal(probeRequest({...supplier,...retired},'sample-model').headers['x-retired'],undefined);

 const individualLimits={
  'sample-model':{contextWindow:1000000,maxTokens:64000},
  'small-model':{contextWindow:128000,maxTokens:16000},
 };
 const sizedSupplier={...supplier,models:['sample-model','small-model'],modelMappings:{'sample-model':'gateway/actual-model'},modelLimits:individualLimits};
 assert.equal(supplierSchema.safeParse({...supplier,modelLimits:{'sample-model':{contextWindow:1024,maxTokens:4096}}}).success,false);
 const sizedConfig=JSON.parse(buildAlias(sizedSupplier,'pi','').env.PASEO_MODEL_CONFIG);
 assert.deepEqual(sizedConfig.modelLimits,{'gateway/actual-model':individualLimits['sample-model'],'small-model':individualLimits['small-model']});
 assert.throws(()=>buildAlias({...supplier,protocol:'chat-completions'},'claude',''),/不兼容/);
 assert.equal(probeRequest(supplier,'sample-model').url,'https://example.com/v1/messages');
 assert.equal(probeRequest({...supplier,protocol:'responses',baseUrl:'https://example.com/v1/'},'sample-model').url,'https://example.com/v1/responses');
 for(const protocol of ['chat-completions','responses','anthropic']) {
  const path=protocol==='chat-completions'?'chat/completions':protocol==='responses'?'responses':'messages';
  assert.equal(probeRequest({...supplier,protocol,baseUrl:'https://example.com/custom/v2/'},'sample-model').url,`https://example.com/custom/v2/${path}`);
 }
 globalThis.fetch=async()=>Response.json({content:[{type:'text',text:'OK'}]});
 assert.equal((await probe(supplier,'sample-model')).ok,true);
 globalThis.fetch=async()=>Response.json({unexpected:true});
 assert.equal((await probe(supplier,'sample-model')).ok,false);
 globalThis.fetch=async()=>new Response(supplier.key,{status:401});
 assert.equal(JSON.stringify(await probe(supplier,'sample-model')).includes(supplier.key),false);
 assert.deepEqual(parseModels({data:[{id:'model-a',display_name:'Model A'},{id:'model-a',display_name:'Model A'},{id:'invalid id'},{id:2}]}),[{id:'model-a',name:'Model A'}]);
 const metadata=parseModels({data:[
  {id:'deepseek-flash',name:'DeepSeek Flash',context_window:1048576,max_output_tokens:393216},
  {id:'claude',max_input_tokens:1000000,max_tokens:128000},
  {id:'router',context_length:200000,top_provider:{context_length:128000,max_completion_tokens:16000}},
  {id:'partial',context_window:128000,max_output_tokens:null},
  {id:'invalid',context_window:-1,max_output_tokens:'4096',max_tokens:Infinity},
 ]});
 assert.deepEqual(metadata,[
  {id:'deepseek-flash',name:'DeepSeek Flash',contextWindow:1048576,maxTokens:393216},
  {id:'claude',name:'claude',contextWindow:1000000,maxTokens:128000},
  {id:'router',name:'router',contextWindow:128000,maxTokens:16000},
  {id:'partial',name:'partial',contextWindow:128000},
  {id:'invalid',name:'invalid'},
 ]);
 assert.deepEqual(discoverRpc.output.parse({ok:true,message:'',models:metadata}).models,metadata);
 assert.throws(()=>parseModels({models:[]}),/格式/);
 assert.throws(()=>parseModels({code:0,data:{models:[{id:'custom'}],agents:[{name:'cli',models:['custom']}]}}),/格式/);
 const requests=[];
 globalThis.fetch=async(url,options)=>{
  requests.push({url,options});
  return Response.json(requests.length===1?{data:[{id:'model-a'}],has_more:true,last_id:'model-a'}:{data:[{id:'model-b'}],has_more:false});
 };
 const catalog=await discoverModels(supplier);
 assert.equal(catalog.ok,true);assert.equal(catalog.models.length,2);
 assert(requests[1].url.includes('after_id=model-a'));
 assert.equal(requests[0].options.headers['x-api-key'],supplier.key);
 globalThis.fetch=async()=>new Response(supplier.key,{status:403});
 const denied=await discoverModels(supplier);assert.equal(denied.ok,false);assert.equal(JSON.stringify(denied).includes(supplier.key),false);
 globalThis.fetch=async()=>Response.json({data:[{id:'same'}],has_more:true,last_id:'same'});
 assert.equal((await discoverModels(supplier)).ok,false);
 // Retired settings cannot change the standard URL or add request context.
 for(const protocol of ['chat-completions','anthropic']) {
  let captured;
  globalThis.fetch=async(url,options)=>{captured={url,options};return Response.json({data:[{id:'standard'}]})};
  assert.equal((await discoverModels({...supplier,...retired,protocol})).ok,true);
  const url=new URL(captured.url);
  assert.equal(url.origin,'https://example.com');assert.equal(url.pathname,'/v1/models');
  assert.equal(captured.options.headers['x-retired'],undefined);
  assert.equal(captured.options.redirect,'error');
 }
 let discoveryCalls=0;
 globalThis.fetch=async()=>{discoveryCalls++;throw Error(supplier.key)};
 assert.equal((await discoverModels({...supplier,baseUrl:'https://user:pass@example.com'})).ok,false);
 assert.equal(discoveryCalls,0);
 for(const baseUrl of ['https://example.com/v1/','https://example.com/v2','https://example.com/custom/v3/','https://example.com/v1beta']) {
  globalThis.fetch=async(url)=>{assert.equal(url,baseUrl.replace(/\/+$/,'')+'/models');return Response.json({data:[]})};
  assert.equal((await discoverModels({...supplier,protocol:'chat-completions',baseUrl})).ok,true);
 }
 globalThis.fetch=async()=>{throw Error(supplier.key)};
 const networkError=await discoverModels(supplier);
 assert.equal(networkError.ok,false);assert.equal(JSON.stringify(networkError).includes(supplier.key),false);
 const handlers=new Map();
 require(join(temp,'index.server.js')).default({handle:(rpc,fn)=>handlers.set(rpc.name,fn)});
 const state=()=>handlers.get(stateRpc.name)({},{});
 const official={claude:{enabled:true},codex:{enabled:true},pi:{enabled:true}};
 let providers=structuredClone(official),failPatch=false;
 const context={paseo:{config:{get:async()=>({config:{providers}}),patch:async({providers:patch})=>{
  if(failPatch)throw Error('simulated');providers=mergeConfig(providers,patch);
 }}}};
 let loaded=await state();
 await assert.rejects(handlers.get(saveRpc.name)({...supplier,models:['sample-model','another-alias'],modelMappings:{'another-alias':'sample-model'},revision:loaded.revision},context),/不能重复/);
 await handlers.get(saveRpc.name)({...supplier,revision:loaded.revision},context);
 loaded=await state();
 assert.equal(loaded.suppliers.length,1);
 assert.equal(JSON.stringify(loaded).includes(supplier.key),false);
 assert.deepEqual(Object.fromEntries(Object.keys(official).map(k=>[k,providers[k]])),official);
 assert.equal(providers[aliasId(supplier.id,'claude')].env.ANTHROPIC_API_KEY,supplier.key);
 assert.equal(buildAlias({...supplier,anthropicAuth:'bearer'},'claude','').env.ANTHROPIC_AUTH_TOKEN,supplier.key);
 await assert.rejects(handlers.get(saveRpc.name)({...supplier,revision:'stale'},context),/其他窗口/);
 await handlers.get(saveRpc.name)({...supplier,key:'',enabled:false,revision:loaded.revision},context);
 assert.equal((await readStore()).suppliers[0].key,supplier.key);
 assert.equal(providers[aliasId(supplier.id,'claude')].enabled,false);
 loaded=await state();failPatch=true;
 await assert.rejects(handlers.get(saveRpc.name)({...supplier,name:'Changed',revision:loaded.revision},context),/恢复/);
 assert.equal((await readStore()).suppliers[0].name,'Example');failPatch=false;
 assert.equal((await stat(join(temp,'home/model-providers/suppliers.json'))).mode&0o777,0o600);
 loaded=await state();
 await handlers.get(saveRpc.name)({...supplier,modelMappings:{'sample-model':'gateway/actual-model'},revision:loaded.revision},context);
 let discoveryRequest;
 globalThis.fetch=async(url,options)=>{discoveryRequest={url,options};return Response.json({data:[{id:'standard'}]})};
 assert.equal((await handlers.get(discoverRpc.name)({id:supplier.id,baseUrl:supplier.baseUrl,protocol:supplier.protocol,anthropicAuth:supplier.anthropicAuth},{})).models.length,1);
 assert.equal(new URL(discoveryRequest.url).pathname,'/v1/models');
 assert.equal(discoveryRequest.options.headers['x-api-key'],supplier.key);
 assert.deepEqual((await state()).suppliers[0].modelMappings,{'sample-model':'gateway/actual-model'});
 let probedModel;
 globalThis.fetch=async(url,options)=>{probedModel=JSON.parse(options.body).model;return Response.json({content:[]});};
 assert.equal((await handlers.get(probeRpc.name)({id:supplier.id,model:'sample-model'},{})).ok,true);
 assert.equal(probedModel,'gateway/actual-model');
 // Legacy native settings are overwritten when a supplier is saved again.
 providers[aliasId(supplier.id,'claude')].env.ANTHROPIC_CUSTOM_HEADERS='X-Retired: removed';
 loaded=await state();
 await handlers.get(saveRpc.name)({...supplier,revision:loaded.revision},context);
 assert.equal(providers[aliasId(supplier.id,'claude')].env.ANTHROPIC_CUSTOM_HEADERS,'');
 providers['mp-collision-claude']={extends:'claude',label:'Owned by user'};
 loaded=await state();
 await assert.rejects(handlers.get(saveRpc.name)({...supplier,id:'collision',revision:loaded.revision},context),/冲突/);
 const source=await readFile(join(temp,'home/model-providers/agent-extension.mjs'),'utf8');
 assert.equal(source.includes(supplier.key),false);
 const ext=await import('file://'+join(temp,'home/model-providers/agent-extension.mjs'));
 process.env.PASEO_MODEL_CONFIG=JSON.stringify({id:'example',baseUrl:'https://example.com',api:'anthropic-messages',models:['sample-model'],contextWindow:32768,maxTokens:1024});
 process.env.PASEO_MODEL_KEY='fake';let registered;
 ext.default({registerProvider:(id,config)=>registered={id,config}});
 assert.equal(registered.id,'example');assert.equal(registered.config.models[0].id,'sample-model');
 process.env.PASEO_MODEL_CONFIG=buildAlias({...supplier,protocol:'responses',modelMappings:{'sample-model':'gateway/actual-model'}},'pi','').env.PASEO_MODEL_CONFIG;
 ext.default({registerProvider:(id,config)=>registered={id,config}});
 assert.equal(registered.config.models[0].id,'gateway/actual-model');
 assert.equal(registered.config.models[0].name,'sample-model');
 process.env.PASEO_MODEL_CONFIG=buildAlias({...supplier,anthropicAuth:'bearer'},'omp','').env.PASEO_MODEL_CONFIG;
 ext.default({registerProvider:(id,config)=>registered={id,config}});
 assert.equal(registered.config.headers.Authorization,'Bearer fake');
 for(const engine of ['pi','omp']) {
  process.env.PASEO_MODEL_CONFIG=buildAlias(sizedSupplier,engine,'').env.PASEO_MODEL_CONFIG;
  ext.default({registerProvider:(id,config)=>registered={id,config}});
  assert.equal(registered.config.models[0].id,'gateway/actual-model');
  assert.equal(registered.config.models[0].contextWindow,1000000);
  assert.equal(registered.config.models[0].maxTokens,64000);
  assert.equal(registered.config.models[1].contextWindow,128000);
  assert.equal(registered.config.models[1].maxTokens,16000);
 }


 console.log('PASS: standard model discovery, retired setting isolation, versioned paths, model metadata and RPC preservation, editable DeepSeek preset, ID mapping across 5 adapters and probes, catalog pagination and failures, config isolation, secrets, conflicts, rollback, permissions and generated extension');
} finally {
 globalThis.fetch=originalFetch;
 if(originalHome===undefined)delete process.env.PASEO_HOME;else process.env.PASEO_HOME=originalHome;
 delete process.env.PASEO_MODEL_CONFIG;delete process.env.PASEO_MODEL_KEY;
 await rm(temp,{recursive:true,force:true});
}
