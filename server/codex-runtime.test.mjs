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
 for (const file of ['shared/contracts.ts', 'server/adapters.ts', 'server/endpoints.ts']) {
  const target=join(temp,file.replace(/\.ts$/,'.js'));
  await mkdir(dirname(target),{recursive:true});
  await writeFile(target,ts.transpileModule(await readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 const {buildAlias}=createRequire(join(temp,'entry.cjs'))(join(temp,'server/adapters.js'));
 for (const path of ['/v2','/custom/v3','']) {
  let receive;
  const received=new Promise(resolve=>{receive=resolve});
  const server=createServer((req,res)=>{
   receive(req.url);
   req.resume();res.writeHead(400,{'content-type':'application/json'});
   res.end(JSON.stringify({error:{message:'Local transport check; no inference',type:'invalid_request_error'}}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const baseUrl=`http://127.0.0.1:${server.address().port}${path}`;
  const alias=buildAlias({id:'review',name:'Review "quoted"',protocol:'responses',baseUrl,key:'local-test-only',models:['review-model'],agents:['codex'],enabled:true},'codex','');
  const command=alias.command??['codex'];
  const host=new CodexAppServerAgentClient(null,{env:alias.env},{customProvider:{id:'mp-review-codex',extends:'codex',label:alias.label}});
  const child=spawn(command[0],[...command.slice(1),'--config','analytics.enabled=false','--config','history.persistence="none"','app-server','--stdio'],{
   cwd:temp,env:buildCodexAppServerEnv({env:alias.env}),stdio:['pipe','pipe','pipe'],
  });
  const exited=once(child,'exit');
  child.stderr.resume();
  const pending=new Map();let nextId=0;
  const lines=createInterface({input:child.stdout});
  lines.on('line',line=>{
   let message;try{message=JSON.parse(line)}catch{return}
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
    const {thread}=await rpc('thread/start',{model:'review-model',cwd:temp,ephemeral:true,sandbox:'read-only',approvalPolicy:'never',config:host.customProviderConfig()??{}});
    await rpc('turn/start',{threadId:thread.id,input:[{type:'text',text:'Local transport check.'}]});
    return received;
   };
   const actual=await Promise.race([exercise(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('No local request within 15s')),15000)})]);
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
