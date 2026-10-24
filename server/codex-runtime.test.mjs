import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

// Optional integration check: requires installed Paseo and Codex, never a real model endpoint.
assert(process.env.PASEO_CODEX_ADAPTER, 'Set PASEO_CODEX_ADAPTER to the installed Paseo codex-app-server-agent.js path');
const { CodexAppServerAgentClient, buildCodexAppServerEnv } = await import(pathToFileURL(resolve(process.env.PASEO_CODEX_ADAPTER)));
const temp = await mkdtemp(join(tmpdir(), 'model-providers-codex-test-'));
try {
 await symlink(resolve('node_modules'), join(temp, 'node_modules'));
 for (const file of ['shared/contracts.ts', 'server/adapters.ts', 'server/endpoints.ts', 'server/codex-models.ts']) {
  const target=join(temp,file.replace(/\.ts$/,'.js'));
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const require=createRequire(join(temp,'entry.cjs'));
 const {buildAlias}=require(join(temp,'server/adapters.js'));
 const {writeCodexCatalog}=require(join(temp,'server/codex-models.js'));
 await mkdir(join(temp,'codex'));
 for (const path of ['/v2','/custom/v3','']) {
  let receive;
  const usageWaiters=new Map(),turnWaiters=new Map();
  const received=new Promise(resolve=>{receive=resolve});
  const server=createServer((req,res)=>{
   receive(req.url);
   req.resume();res.writeHead(200,{'content-type':'text/event-stream'});
   res.end('event: response.completed\ndata: '+JSON.stringify({type:'response.completed',response:{id:'resp_local',object:'response',status:'completed',output:[{type:'message',role:'assistant',id:'msg_local',status:'completed',content:[{type:'output_text',text:'OK',annotations:[]}]}],usage:{input_tokens:10,output_tokens:1,total_tokens:11,input_tokens_details:{cached_tokens:0}}}})+'\n\n');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseUrl=`http://127.0.0.1:${server.address().port}${path}`;
  const supplier={id:'review',name:'Review "quoted"',protocol:'responses',baseUrl,key:'local-test-only',models:['review-model','small-model'],modelMappings:{'review-model':'gateway/review-model'},modelLimits:{'review-model':{contextWindow:1000000,maxTokens:64000},'small-model':{contextWindow:128000,maxTokens:16000}},contextWindow:32768,maxTokens:4096,agents:['codex'],enabled:true};
  const catalogPath=await writeCodexCatalog(supplier,join(temp,'extension.mjs'));
  const alias=buildAlias(supplier,'codex','',catalogPath);
  const command=alias.command??['codex'];
  const host=new CodexAppServerAgentClient(null,{env:alias.env},{customProvider:{id:'mp-review-codex',extends:'codex',label:alias.label}});
  const child=spawn(command[0],[...command.slice(1),'--config','analytics.enabled=false','--config','history.persistence="none"','app-server','--stdio'],{
   cwd:temp,env:buildCodexAppServerEnv({env:{...alias.env,CODEX_HOME:join(temp,'codex')}}),stdio:['pipe','pipe','pipe'],
  });
  const exited=once(child,'exit');
  let errors='';child.stderr.on('data',chunk=>{errors+=chunk});
  const pending=new Map();let nextId=0;
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
   let message;try{message=JSON.parse(line)}catch{return}
   if(message.method==='thread/tokenUsage/updated'){const resolve=usageWaiters.get(message.params.threadId);if(resolve){usageWaiters.delete(message.params.threadId);resolve(message.params);}}
   if(message.method==='turn/completed'){const resolve=turnWaiters.get(message.params.threadId);if(resolve){turnWaiters.delete(message.params.threadId);resolve();}}
   const waiter=pending.get(message.id);if(!waiter)return;
   pending.delete(message.id);
   message.error?waiter.reject(Error(message.error.message)):waiter.resolve(message.result);
  });
  const rpc=(method,params)=>new Promise((resolve,reject)=>{
   const id=++nextId;pending.set(id,{resolve,reject});
   child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
  });
  let timeout;
  try {
   const exercise=async()=>{
    await rpc('initialize',{clientInfo:{name:'local-review',version:'1'},capabilities:{experimentalApi:true}});
    child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'initialized'})+'\n');
    let thread;
    for(const [model,contextWindow] of [['gateway/review-model',1000000],['small-model',128000]]) {
     if(!thread)({thread}=await rpc('thread/start',{model,cwd:temp,ephemeral:true,sandbox:'read-only',approvalPolicy:'never',config:host.customProviderConfig()??{}}));
     const usage=new Promise(resolve=>usageWaiters.set(thread.id,resolve));
     const completed=new Promise(resolve=>turnWaiters.set(thread.id,resolve));
     await rpc('turn/start',{threadId:thread.id,model,input:[{type:'text',text:'Local transport check.'}]});
     const reported=(await usage).tokenUsage.modelContextWindow;await completed;
     assert.equal(reported,Math.floor(contextWindow*0.95),`Codex must use the selected model's configured context window, with its native reserve`);
     console.log(`PASS: Codex ${model} context ${contextWindow} -> usable ${reported}`);
    }
    return received;
   };
   const actual=await Promise.race([exercise(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Codex runtime check timed out: '+errors.slice(-1000))),15000)})]);
   assert.equal(actual,`${path||'/v1'}/responses`);
   console.log(`PASS: actual Codex request ${path||'/v1'}/responses`);
  } finally {
   clearTimeout(timeout);child.kill('SIGTERM');await exited;lines.close();
   server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
 }
} finally {
 await rm(temp,{recursive:true,force:true});
}
