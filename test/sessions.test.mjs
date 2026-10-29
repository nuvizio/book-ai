import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SessionStore } from '../src/sessions.mjs';
import { startServer } from '../src/server.mjs';
const payload=(id='project-one',request='request-one',text='A soft guitar')=>({session_id:id,request_id:request,model:'test-model',messages:[{role:'system',content:'Be musical'},{role:'user',content:text}]});

test('project conversation survives a store restart and element changes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'book-session-'));
 try{
  let store=new SessionStore(dir);await store.complete(payload(),async()=> 'Try fingerpicking');
  store=new SessionStore(dir);let actual;
  await store.complete(payload('project-one','request-two','Now the chorus'),async args=>{actual=args.messages;return 'Lift the chorus';});
  assert.deepEqual(actual.map(m=>m.content),['Be musical','A soft guitar','Try fingerpicking','Now the chorus']);
  assert.equal(store.read('project-one').messages.length,4);
  assert.equal(fs.statSync(path.join(dir,'project-one.json')).mode&0o777,0o600);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('sessions are isolated and duplicate turns never call the provider twice',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'book-session-'));const store=new SessionStore(dir);let n=0;
 try{
  const first=await store.complete(payload(),async()=>{n++;return 'answer';});
  const again=await store.complete(payload(),async()=>{n++;return 'other';});
  assert.equal(n,1);assert.equal(first.text,again.text);assert.equal(again.replayed,true);
  await assert.rejects(store.complete(payload('project-one','request-one','different'),async()=>''),/different turn/);
  await store.complete(payload('project-two','request-one'),async args=>{assert.equal(args.messages.length,2);return 'independent';});
  await assert.rejects(store.complete(payload('../escape'),async()=>''),/Invalid session/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('provider failure leaves the archive unchanged and releases session concurrency',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'book-session-'));const store=new SessionStore(dir);
 try{
  await assert.rejects(store.complete(payload(),async()=>{throw Error('capacity');}),/capacity/);
  assert.equal(store.read('project-one').messages.length,0);
  await store.complete(payload(),async()=> 'recovered');assert.equal(store.read('project-one').messages.length,2);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('session endpoints require pairing and preserve the same conversation through HTTP',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'book-session-'));const contexts=[];
 const instance=await startServer({sessionDirectory:dir,chatCompletion:async args=>{contexts.push(args.messages);return 'original music';}});
 const headers={'Content-Type':'application/json','Authorization':'Bearer '+instance.sessionToken};
 try{
  let r=await fetch(instance.url+'/v1/sessions/project-one',{method:'PUT'});assert.equal(r.status,401);
  r=await fetch(instance.url+'/v1/sessions/project-one',{method:'PUT',headers});assert.equal(r.status,200);
  r=await fetch(instance.url+'/v1/chat/completions',{method:'POST',headers,body:JSON.stringify(payload())});let d=await r.json();assert.equal(r.status,200);assert.equal(d.session.id,'project-one');
  r=await fetch(instance.url+'/v1/chat/completions',{method:'POST',headers,body:JSON.stringify(payload('project-one','request-two','Refine chorus'))});d=await r.json();assert.equal(d.session.message_count,4);assert.equal(contexts[1].length,4);
  r=await fetch(instance.url+'/v1/sessions/project-one',{headers});d=await r.json();assert.equal(d.messages.length,4);
 }finally{await new Promise(resolve=>instance.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true});}
});

test('Codex event transport yields only the final assistant text',async()=>{
 const {extractCodexMessage}=await import('../src/llm/cli-provider.mjs');
 const events=[{type:'thread.started',thread_id:'native-thread'},{type:'item.completed',item:{type:'agent_message',text:'earlier'}},{type:'item.completed',item:{type:'command_execution',aggregated_output:'not assistant text'}},{type:'item.completed',item:{type:'agent_message',text:'{"kind":"message","message":"ready","changes":[]}'}}].map(x=>JSON.stringify(x)).join('\n');
 assert.equal(JSON.parse(extractCodexMessage(events)).message,'ready');
 assert.equal(extractCodexMessage('invalid transport'),null);
});
