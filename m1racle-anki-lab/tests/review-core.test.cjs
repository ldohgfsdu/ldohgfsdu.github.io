const {test}=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../review-core.js');
const now=new Date(2026,10,6,12,0,0);
const decks={1:'Medicine',2:'Medicine::Physiology',3:'Medicine::Anatomy',4:'Language'};
const rows=[{cid:1,did:2},{cid:2,did:2},{cid:3,did:3},{cid:4,did:4}];
const result=(state=1,minutes=10)=>({card:{state,due:new Date(+now+minutes*60000),last_review:now}});
const queue=(s,did='all',time=now)=>Core.selectQueue(rows,s,decks,did,'due',time).map(r=>r.cid);

test('study-day boundary uses local calendar dates, including month rollover',()=>{
  assert.equal(Core.dayKey(new Date(2026,10,1,3,59)), '2026-10-31');
  assert.equal(Core.dayKey(new Date(2026,10,1,4)), '2026-11-01');
  assert.equal(Core.nextBoundary(new Date(2026,10,6,3,59)),+new Date(2026,10,6,4));
  assert.equal(Core.nextBoundary(new Date(2026,10,6,4)),+new Date(2026,10,7,4));
});
test('parent and sibling deck matching avoids prefix collisions',()=>{
  assert.deepEqual(queue(Core.empty(),'1'),[1,2,3]);
  assert.deepEqual(queue(Core.empty(),'2'),[1,2]);
  assert.equal(Core.matches({did:99},'1',{...decks,99:'Medicine Extra'}),false);
});
test('zero new-card cap stops new cards, without stopping intraday learning',()=>{
  let s=Core.configure(Core.empty(),'all',{newLimit:0,reviewLimit:0},4);
  s.records[1]={card:{state:1,due:now,last_review:now},reviewedAt:now};
  s.records[2]={card:{state:3,due:now,last_review:now},reviewedAt:now};
  assert.deepEqual(queue(s),[1,2]);
  assert.equal(Core.counts(rows,s,decks,'all',now).relearning,1);
});
test('child and parent caps apply when studying the child directly',()=>{
  let s=Core.configure(Core.empty(),'1',{newLimit:1,reviewLimit:200},4);
  assert.equal(queue(s,'1').length,1);
  assert.equal(queue(s,'2').length,1);
  s=Core.grade(s,rows[2],result(),3,now);
  assert.deepEqual(queue(s,'2'),[]);
  assert.deepEqual(queue(s,'4'),[4]);
});
test('new cards consume the daily quota only once; undo restores quota and history',()=>{
  let s=Core.configure(Core.empty(),'all',{newLimit:1,reviewLimit:200},4);
  s=Core.grade(s,rows[0],result(),3,now);
  assert.deepEqual(queue(s),[]);
  assert.equal(Core.used(s,decks,'all','new',now),1);
  const before=JSON.parse(JSON.stringify(s));
  s=Core.grade(s,rows[0],result(2,1440),3,new Date(+now+10*60000));
  assert.equal(Core.used(s,decks,'all','new',now),1);
  assert.equal(Core.used(s,decks,'all','review',now),0);
  s=Core.undo(s);
  assert.deepEqual(s.records,before.records);
  assert.deepEqual(s.usage,before.usage);
  const firstUndo=Core.undo(before);
  assert.deepEqual(queue(firstUndo),[1]);
  assert.equal(Core.used(firstUndo,decks,'all','new',now),0);
});
test('review day due includes later today but not next learning day',()=>{
  const s=Core.empty();
  s.records[1]={card:{state:2,due:new Date(2026,10,7,3,59)}};
  s.records[2]={card:{state:2,due:new Date(2026,10,7,4)}};
  assert.equal(Core.due(rows[0],s,now),true);
  assert.equal(Core.due(rows[1],s,now),false);
});
test('interday learning uses review cap; same-day relearning is exempt',()=>{
  let s=Core.configure(Core.empty(),'all',{newLimit:0,reviewLimit:0},4);
  s.records[1]={card:{state:1,due:now},reviewedAt:new Date(2026,10,5,12)};
  s.records[2]={card:{state:3,due:now},reviewedAt:now};
  assert.deepEqual(queue(s),[2]);
});
test('review quota persists over reload and rolls over at configured local hour',()=>{
  let s=Core.configure(Core.empty(),'all',{newLimit:0,reviewLimit:1},4);
  for(const row of rows)s.records[row.cid]={card:{state:2,due:now}};
  s=Core.grade(s,rows[0],result(2,1440),3,now);
  s=Core.normalize(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(queue(s),[]);
  assert.equal(queue(s,'all',new Date(2026,10,7,4)).length,1);
});
test('bury expires exactly next learning day and can be manually undone by deck',()=>{
  let s=Core.bury(Core.empty(),1,now);s=Core.bury(s,4,now);
  assert.deepEqual(queue(s),[2,3]);
  assert.equal(Core.isBuried(rows[0],s,new Date(2026,10,7,3,59)),true);
  assert.equal(Core.isBuried(rows[0],s,new Date(2026,10,7,4)),false);
  s=Core.unbury(s,rows,decks,'1');
  assert.deepEqual(queue(s),[1,2,3]);
});
test('suspension survives day changes, browse mode still exposes card for recovery',()=>{
  const s=Core.suspend(Core.empty(),1);
  assert.deepEqual(queue(s),[2,3,4]);
  assert.deepEqual(queue(s,'all',new Date(2026,10,8,12)),[2,3,4]);
  assert.equal(Core.selectQueue(rows,s,decks,'all','all',now).length,4);
  assert.throws(()=>Core.grade(s,rows[0],result(),3,now),/恢复/);
  assert.deepEqual(queue(Core.suspend(s,1)),[1,2,3,4]);
});
test('undo never overwrites a changed review or changed daily usage',()=>{
  let s=Core.grade(Core.empty(),rows[0],result(),3,now);
  s.records[1].grade=4;assert.throws(()=>Core.undo(s),/改变/);
  s=Core.grade(Core.empty(),rows[0],result(),3,now);
  s.usage[Core.dayKey(now)]['2'].new=5;assert.throws(()=>Core.undo(s),/改变/);
});
test('queue wakes for delayed learning and suspended cards do not trigger it',()=>{
  const s=Core.empty();s.records[1]={card:{state:1,due:new Date(+now+60000)}};
  assert.equal(Core.nextWake(rows,s,decks,'all',now),+now+60000);
  s.suspended[1]=true;
  assert.equal(Core.nextWake(rows,s,decks,'all',now),Core.nextBoundary(now));
});
test('clear progress retains options, suspension, bury and removes stale undo',()=>{
  let s=Core.grade(Core.empty(),rows[0],result(),3,now);
  s=Core.bury(Core.suspend(s,2),3,now);s=Core.reset(s);
  assert.deepEqual(s.records,{});assert.deepEqual(s.usage,{});assert.equal(s.undo,null);
  assert.equal(s.suspended[2],true);assert.ok(s.buried[3]);
});
test('invalid configuration and malformed storage fail before mutation',()=>{
  assert.throws(()=>Core.configure(Core.empty(),'all',{newLimit:-1,reviewLimit:20},4));
  assert.throws(()=>Core.configure(Core.empty(),'all',{newLimit:1.5,reviewLimit:20},4));
  assert.throws(()=>Core.configure(Core.empty(),'all',{newLimit:20,reviewLimit:20},24));
  assert.throws(()=>Core.normalize({version:99}));
  assert.throws(()=>Core.normalize({...Core.empty(),records:[]}));
});
test('vendored HTTP SHA-256 fallback matches Node crypto for small and large packages',async()=>{
  const {sha256}=await import('../vendor/noble/sha2.js');
  const {createHash}=require('node:crypto');
  for(const data of [Buffer.alloc(0),Buffer.from('abc'),Buffer.alloc(1024*1024,93)]){
    assert.equal(Buffer.from(sha256(data)).toString('hex'),createHash('sha256').update(data).digest('hex'));
  }
});
function progressFixture(){
 const s=Core.empty();
 const card={state:2,due:new Date(+now+86400000).toISOString(),last_review:now.toISOString(),stability:2,difficulty:5,reps:1,lapses:0,elapsed_days:0,scheduled_days:1,learning_steps:0};
 return {format:'m1racle-anki-progress-v1',packageHash:'a'.repeat(64),state:Core.grade(s,rows[0],{card},4,now)};
}
test('progress backup restores ratings and caps and starts a fresh undo history',()=>{
 const data=progressFixture(),restored=Core.restoreBackup(data,data.packageHash,rows,decks);
 assert.deepEqual(restored.records,data.state.records);assert.deepEqual(restored.usage,data.state.usage);assert.equal(restored.undo,null);
});
test('progress backup rejects different package bytes and unknown cards',()=>{
 const data=progressFixture();assert.throws(()=>Core.restoreBackup(data,'b'.repeat(64),rows,decks),/当前卡包/);
 data.state.records[999]=data.state.records[1];assert.throws(()=>Core.restoreBackup(data,data.packageHash,rows,decks),/卡片记录/);
});
test('progress backup validates dates, scheduler values and daily options',()=>{
 for(const mutate of [d=>d.state.records[1].card.due='invalid',d=>d.state.records[1].card.stability=-1,d=>d.state.options.all={newLimit:-1,reviewLimit:200},d=>d.state.usage['bad-day']={}]){
  const data=progressFixture();mutate(data);assert.throws(()=>Core.restoreBackup(data,data.packageHash,rows,decks));
 }
});
