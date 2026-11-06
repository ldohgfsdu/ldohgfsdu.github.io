const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const fixture='/tmp/m1racle-anki/kevin-fixture.apkg';
const bytes=fs.readFileSync(fixture);
const url=process.env.ANKI_TEST_URL||'http://127.0.0.1:8765/m1racle-anki-lab/';
async function state(page){return page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('m1racle_anki_state_')))));}
async function ready(page){await page.waitForFunction(()=>!document.querySelector('#file').disabled&&!document.querySelector('#reveal').disabled);}
async function importDeck(page,file=fixture){
 await page.locator('#file').setInputFiles(file);
 await page.waitForFunction(()=>document.querySelector('#meta').textContent.includes('卡片 2')&&!document.querySelector('#file').disabled);
}
async function configure(page,newLimit){
 const details=page.locator('#options-form').locator('..');
 if(await details.getAttribute('open')===null)await details.locator('summary').click();
 await page.locator('#new-limit').fill(String(newLimit));
 await page.locator('#options-form button').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('选项已保存'));
}
async function grade(page,value){
 await ready(page);await page.locator('#reveal').click();
 await page.locator('#grade [data-grade="'+value+'"]').click();
 await page.waitForFunction(()=>!document.querySelector('#file').disabled);
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 let legacyRecord;
 try{
  for(const width of [390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390,timezoneId:'Asia/Shanghai'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
   await page.goto(url,{waitUntil:'load'});assert.match(await page.title(),/v3\.4/);
   await importDeck(page);await ready(page);
   assert.equal(await page.locator('#front .m1-ic-mask').count(),2);
   assert.equal(await page.locator('#front .m1-ic-mask-open').count(),0);
   const img=page.locator('#front .m1-ic-wrap > img');
   await img.evaluate(el=>{el.dataset.identity='same-image-node';});
   if(width===390)await page.locator('#front .m1-ic-mask').first().tap();
   else await page.locator('#front .m1-ic-mask').first().click();
   assert.equal(await page.locator('#front .m1-ic-mask-open').count(),1);
   await page.locator('#reveal').click();
   assert.equal(await page.locator('#front .m1-ic-mask-open').count(),2);
   assert.equal(await img.getAttribute('data-identity'),'same-image-node');
   assert.equal(await page.locator('#back img').count(),0);
   assert.equal(await page.locator('#grade small').count(),4);
   await page.screenshot({path:'/tmp/anki-v34-'+width+'-reveal.png'});
   await page.locator('#grade [data-grade="3"]').click();await ready(page);
   assert.equal(Object.keys((await state(page)).records).length,1);
   await page.locator('#undo').click();await ready(page);
   assert.equal(Object.keys((await state(page)).records).length,0);
   await page.locator('#suspend').click();await ready(page);
   assert.equal(Object.keys((await state(page)).suspended).length,1);
   await page.locator('#scope').selectOption('all');await ready(page);
   assert.equal(await page.locator('#suspend').innerText(),'恢复此卡');
   await page.locator('#reveal').click();assert.equal(await page.locator('#grade [data-grade="3"]').isDisabled(),true);
   await page.locator('#suspend').click();await ready(page);
   await page.locator('#scope').selectOption('due');await ready(page);
   await page.locator('#bury').click();await ready(page);await page.locator('#bury').click();
   await page.locator('#empty-queue').waitFor();assert.match(await page.locator('#counts').innerText(),/搁置 2/);
   await page.locator('#unbury').click();await ready(page);assert.equal(Object.keys((await state(page)).buried).length,0);
   await configure(page,1);await grade(page,4);
   await page.locator('#empty-queue').waitFor();assert.equal(await page.locator('#undo').isVisible(),true);assert.equal(await page.locator('#undo').isDisabled(),false);
   await page.screenshot({path:'/tmp/anki-v34-'+width+'-empty-undo.png'});
   const first=await state(page);assert.equal(Object.keys(first.records).length,1);legacyRecord=Object.values(first.records)[0];
   await page.reload();await page.locator('#restore').click();await page.locator('#empty-queue').waitFor();
   assert.deepEqual((await state(page)).records,first.records);
   await importDeck(page,{name:'renamed.apkg',mimeType:'application/octet-stream',buffer:bytes});await page.locator('#empty-queue').waitFor();
   assert.deepEqual((await state(page)).records,first.records,'renaming identical bytes preserves progress');
   await page.locator('#undo').click();await ready(page);
   await page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    window.restoreTestStorage=()=>{Storage.prototype.setItem=original;};
    Storage.prototype.setItem=function(key,value){if(key.startsWith('m1racle_anki_state_'))throw new DOMException('simulated full storage','QuotaExceededError');return original.call(this,key,value);};
   });
   await grade(page,4);assert.match(await page.locator('#status').innerText(),/未保存/);
   assert.equal(Object.keys((await state(page)).records).length,0,'failed save never advances queue');
   assert.equal((await state(page)).undo,null,'failed save never leaves a dangling undo snapshot');
   await page.evaluate(()=>window.restoreTestStorage());
   await configure(page,20);await grade(page,4);await grade(page,4);
   await page.locator('#empty-queue').waitFor();assert.equal(await page.locator('#undo').isDisabled(),false,'last card remains undoable');
   await page.locator('#undo').click();await ready(page);assert.equal(Object.keys((await state(page)).records).length,1);
   page.once('dialog',dialog=>dialog.accept());await page.locator('#reset').click();await ready(page);
   assert.equal((await state(page)).undo,null);assert.equal(Object.keys((await state(page)).records).length,0);
   assert.equal(errors.length,0,'browser console and JS errors: '+errors.join('; '));
   console.log('PASS '+width+'px: original reveal, touch, FSRS, limits, empty-queue undo, bury/unbury, suspend/recover, reload, rename, failed-storage atomicity, last-card undo, reset');
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});
  const page=await context.newPage();
  await page.clock.install({time:new Date('2026-11-06T10:00:00Z')});
  await page.goto(url);await importDeck(page);await configure(page,1);await grade(page,1);
  await page.locator('#empty-queue').waitFor();await page.clock.fastForward(70000);
  await page.locator('#front .m1-ic-mask').first().waitFor();assert.match(await page.locator('#counts').innerText(),/学习中 1/);
  console.log('PASS: waiting learning card automatically reappears without reload');await context.close();
  const legacyContext=await browser.newContext({timezoneId:'Asia/Shanghai'});
  const legacyPage=await legacyContext.newPage();await legacyPage.goto(url);
  // Valid ZIPs with different one-byte trailing comments have the same name/size.
  const variantA=Buffer.concat([bytes,Buffer.from('A')]),variantB=Buffer.concat([bytes,Buffer.from('B')]);
  const name='collision.apkg',size=variantA.length;
  const legacyPrefix='m1racle_anki_review_'+name+'_'+size+'_';
  await legacyPage.evaluate(({prefix,name,size,record})=>{
   localStorage.setItem(prefix+'1',JSON.stringify(record));
   localStorage.setItem('m1racle_anki_suspend_'+name+'_'+size+'_2','1');
  },{prefix:legacyPrefix,name,size,record:legacyRecord});
  await importDeck(legacyPage,{name,mimeType:'application/octet-stream',buffer:variantA});
  assert.equal(Object.keys((await state(legacyPage)).records).length,1,'v3.3 score migrates');
  assert.equal((await state(legacyPage)).suspended['2'],true,'v3.3 suspension migrates');
  assert.equal((await state(legacyPage)).undo,null,'legacy undo is not advertised');
  assert.ok(await legacyPage.evaluate(prefix=>localStorage.getItem(prefix+'1'),legacyPrefix),'legacy record retained');
  await importDeck(legacyPage,{name,mimeType:'application/octet-stream',buffer:variantB});
  const keyA='m1racle_anki_state_'+createHash('sha256').update(variantA).digest('hex');
  const keyB='m1racle_anki_state_'+createHash('sha256').update(variantB).digest('hex');
  const independent=await legacyPage.evaluate(keys=>keys.map(key=>JSON.parse(localStorage.getItem(key))),[keyA,keyB]);
  assert.equal(Object.keys(independent[0].records).length,1);
  assert.equal(Object.keys(independent[1].records).length,0,'same name and size do not mix histories');
  assert.deepEqual(independent[1].suspended,{},'legacy binding prevents an unrelated package inheriting suspension');
  await importDeck(legacyPage,{name:'renamed-collision.apkg',mimeType:'application/octet-stream',buffer:variantA});
  assert.match(await legacyPage.locator('#counts').innerText(),/已评分 1/);
  assert.match(await legacyPage.locator('#counts').innerText(),/暂停 1/);
  console.log('PASS: v3.3 migration, retained legacy backup, same-name/size collision isolation and renamed migrated package');
  await legacyContext.close();

 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
