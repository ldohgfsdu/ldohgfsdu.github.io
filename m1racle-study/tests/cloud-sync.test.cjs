// Run: node --test tests/cloud-sync.test.cjs
// In-memory simulated REST API to validate sync semantics without a real Supabase account.
const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const {webcrypto}=require('node:crypto');
const code=fs.readFileSync(require('node:path').join(__dirname,'../site/assets/cloud-sync.js'),'utf8');
const USER='00000000-0000-4000-8000-000000000111';
function memory(){let map=new Map();return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]||null,get length(){return map.size}}}
function api(){
 const docs=new Map(),attempts=new Map(),counter={reads:0,writes:0};
 const wrap=(status,value)=>({ok:status>=200&&status<300,status,statusText:String(status),async text(){return value===null?'':JSON.stringify(value)}});
 return {docs,attempts,counter,fetch:async(url,opts={})=>{
  const u=new URL(url),p=u.pathname,q=u.searchParams,method=opts.method||'GET',b=opts.body?JSON.parse(opts.body):null;
  if(p==='/auth/v1/token'&&method==='POST')return wrap(200,{user:{id:USER,email:'tester@demo.invalid'},access_token:'access123',refresh_token:'refresh123',expires_in:3600});
  if(p==='/auth/v1/user')return wrap(200,{id:USER,email:'tester@demo.invalid'});
  if(p==='/auth/v1/logout')return wrap(204,null);
  if(p==='/rest/v1/study_documents'){
   const key=()=>[q.get('namespace')?.slice(3),decodeURIComponent(q.get('item_key')||'').slice(3)].join('|');
   if(method==='GET'){
    counter.reads++;
    let records=[...docs.values()];if(q.get('namespace'))records=records.filter(r=>r.namespace===q.get('namespace').slice(3));
    if(q.get('item_key'))records=records.filter(r=>r.item_key===q.get('item_key').slice(3));
    return wrap(200,records.slice(Number(q.get('offset')||0),Number(q.get('offset')||0)+Number(q.get('limit')||1000)));
   }
   if(method==='POST'){
     const k=b.namespace+'|'+b.item_key;if(docs.has(k))return wrap(409,{message:'duplicate'});
     docs.set(k,b);counter.writes++;return wrap(201,[b]);
   }
   if(method==='PATCH'){
     const k=key();const old=docs.get(k);
     if(old&&old.version===Number(q.get('version').slice(3))){const row={...old,...b};docs.set(k,row);counter.writes++;return wrap(200,[row])}
     return wrap(200,[]);
   }
  }
  if(p==='/rest/v1/question_attempts'&&method==='POST'){
    if(attempts.has(b.id))return wrap(409,{message:'duplicate'});attempts.set(b.id,b);return wrap(201,null)
  }
  return wrap(404,{message:'Unknown test route '+p+' '+method});
 }}
}
function device(server,initial={}){
 const local=memory();for(const [key,val] of Object.entries(initial))local.setItem(key,JSON.stringify(val));
 const listeners={};const win={M1_CLOUD_CONFIG:{url:'https://demo.supabase.co',publishableKey:'sb_publishable_test_x'},
   addEventListener:(type,f)=>{(listeners[type]??=[]).push(f)},dispatchEvent:(e)=>{for(const f of listeners[e.type]||[])f(e)}};
 const nav={onLine:true,locks:{request:async(_,fn)=>fn()}};
 const context=vm.createContext({window:win,globalThis:win,localStorage:local,crypto:webcrypto,fetch:server.fetch,navigator:nav,
   CustomEvent:class{constructor(type,opt){this.type=type;this.detail=opt.detail}},Date,Math,JSON,URL,TextEncoder,clearTimeout,setTimeout,setInterval:()=>0,Uint8Array,console});
 vm.runInContext(code,context,{filename:'cloud-sync.js'});
 return {cloud:win.M1Cloud,local,nav};
}
test('flatten/unflatten preserve independent physical records',()=>{
 const d=device(api());const src={mastery:{1:2,20:1},flags:{3:false},notes:{2:'个人笔记'},drillChecks:{8:{0:true,1:false}},rubricScores:{1:{3:4}},attempts:[{date:'2026-11-05T12:00:00Z',correct:8,total:10}],theme:'ink'};
 const f=d.cloud.helpers.flatten('physical',src),out=d.cloud.helpers.unflatten('physical',f);
 assert.equal(out.mastery[1],2);assert.equal(out.notes[2],'个人笔记');assert.equal(out.drillChecks[8][1],false);assert.equal(out.rubricScores[1][3],4);assert.equal(out.theme,'ink');assert.equal(out.attempts.length,1);
});
test('old browser records are not silently overwritten, merge + cross-device pull works',async()=>{
 const server=api(),first=device(server,{'m1racle_study_platform_v1':{answered:{'phys-001':{selected:2,correct:true,date:13}},wrong:{},starred:{},sessions:[]},'phys_exam_lab_2025_v1':{notes:{8:'过去的笔记'},mastery:{4:2}}});
 await first.cloud.login('tester@demo.invalid','1234567');
 assert.equal(first.cloud.mode,'migration');assert.equal(server.docs.size,0);
 await first.cloud.migrate('merge');
 assert.equal(first.cloud.mode,'ready');assert.equal(server.docs.get('physical|notes/8').payload,'过去的笔记');
 const second=device(server);await second.cloud.login('tester@demo.invalid','1234567');
 assert.equal(JSON.parse(second.local.getItem('phys_exam_lab_2025_v1')).notes['8'],'过去的笔记');
 const secondState=JSON.parse(second.local.getItem('phys_exam_lab_2025_v1'));secondState.mastery[9]=2;
 second.cloud.localSave('physical',secondState);await second.cloud.synchronize();
 await first.cloud.synchronize();assert.equal(JSON.parse(first.local.getItem('phys_exam_lab_2025_v1')).mastery['9'],2);
});
test('concurrent notes updates trigger conflict, never silently overwrite',async()=>{
 const server=api(),d1=device(server,{'phys_exam_lab_2025_v1':{notes:{9:'before'}}});await d1.cloud.login('tester@demo.invalid','1');await d1.cloud.migrate('merge');
 const d2=device(server);await d2.cloud.login('tester@demo.invalid','1');
 const s1=JSON.parse(d1.local.getItem('phys_exam_lab_2025_v1'));const s2=JSON.parse(d2.local.getItem('phys_exam_lab_2025_v1'));
 s1.notes[9]='computer';s2.notes[9]='phone';d1.cloud.localSave('physical',s1);d2.cloud.localSave('physical',s2);
 await d1.cloud.synchronize();await d2.cloud.synchronize();
 assert.equal(d2.cloud.mode,'conflict');assert.equal(d2.cloud.listConflicts().length,1);
 assert.equal(server.docs.get('physical|notes/9').payload,'computer');
 await d2.cloud.resolveConflict('physical|notes/9','remote');assert.equal(d2.cloud.listConflicts().length,0);
 assert.equal(JSON.parse(d2.local.getItem('phys_exam_lab_2025_v1')).notes[9],'computer');
});
test('offline queue retries once and answer events are idempotent',async()=>{
 const server=api(),d=device(server);await d.cloud.login('tester@demo.invalid','1');
 d.nav.onLine=false;
 const state={answered:{'phys-001':{selected:2,correct:true,date:13}},wrong:{},starred:{},sessions:[]};
 d.cloud.localSave('platform',state);d.cloud.pushAttempt('phys-001',2,true);
 await d.cloud.synchronize();assert.equal(d.cloud.mode,'offline');assert.equal(server.docs.size,0);
 d.nav.onLine=true;await d.cloud.synchronize();assert.equal(server.docs.size,1);assert.equal(server.attempts.size,1);
 await d.cloud.synchronize();assert.equal(server.attempts.size,1);assert.equal(d.cloud.queue.length,0);
});
