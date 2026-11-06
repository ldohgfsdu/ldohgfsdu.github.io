const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.STUDY_TEST_URL||'http://127.0.0.1:8765/m1racle-study/site/';
const fixture='/tmp/m1racle-anki/kevin-fixture.apkg';
const screenshots=process.env.STUDY_SHOTS||'/tmp/study-v10';
fs.mkdirSync(screenshots,{recursive:true});
const USER='3f6b0f48-d36d-48d7-9c31-7eccacb1be50';
const CAT='ttsx-2027-basic-strengthening';
const groups=[{catalog_key:CAT,group_no:2,group_title:'生理核心—真题—串联',subject:'生理学',lesson_type:'core_review',listed_video_count:48,capture_status:'complete'}];
const lesson={id:CAT+'-g02-l004',group_no:2,lesson_no:4,study_order:1,display_title:'绪论1',verification_status:'verified_from_screenshot',duration_seconds:null};
async function clickNav(page,view){await page.locator((await page.locator('.sidebar').isVisible()?'.side-nav':'.mobile-nav')+' [data-view="'+view+'"]').click();}
async function noOverflow(page){
 const bounds=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
  outside:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>({tag:e.tagName,class:e.className,right:e.getBoundingClientRect().right}))}));
 assert.ok(bounds.scroll<=bounds.width+1,'horizontal overflow: '+JSON.stringify(bounds));
}
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},hasTouch:width<600,isMobile:width<600,timezoneId:'Asia/Shanghai'});
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base);assert.match(await page.title(),/医学学习工作台/);
   assert.equal(await page.locator('.module-card').count(),5);await noOverflow(page);
   await page.screenshot({path:screenshots+'/home-'+width+'.png'});
   await clickNav(page,'questions');await page.locator('#start-practice').click();
   await page.locator('[data-answer="2"]').click();assert.equal(await page.locator('.answer-block').count(),1);await noOverflow(page);
   await clickNav(page,'mindmaps');await page.locator('#map-search').fill('心电图');assert.match(await page.locator('#app-main').innerText(),/心电图/);await noOverflow(page);
   await clickNav(page,'courses');await page.getByRole('heading',{name:'登录后查看完整课表'}).waitFor();await noOverflow(page);
   await clickNav(page,'anki');let frame=page.frameLocator('.anki-frame');
   await frame.locator('#file').setInputFiles(fixture);
   await frame.locator('#front .m1-ic-mask').first().waitFor();
   await page.waitForFunction(()=>document.querySelector('.anki-frame').getBoundingClientRect().height>500);
   assert.equal(await frame.locator('#front .m1-ic-mask').count(),2);
   await frame.locator('#front .m1-ic-wrap > img').evaluate(el=>{el.dataset.qaIdentity='same-card';});
   if(width<600)await frame.locator('#front .m1-ic-mask').first().tap();else await frame.locator('#front .m1-ic-mask').first().press('Space');
   assert.equal(await frame.locator('#front .m1-ic-mask-open').count(),1);
   await clickNav(page,'courses');await clickNav(page,'anki');
   assert.equal(await frame.locator('#front .m1-ic-mask-open').count(),1,'reveal state survives route change');
   assert.equal(await frame.locator('#front .m1-ic-wrap > img').getAttribute('data-qa-identity'),'same-card','original iframe image retained');
   await frame.locator('#reveal').click();await frame.locator('#grade [data-grade="4"]').click();
   await frame.locator('#front .m1-ic-mask').first().waitFor();await noOverflow(page);
   await frame.getByText('复习记录备份与迁移',{exact:true}).click();
   const downloadPromise=page.waitForEvent('download');await frame.locator('#export-progress').click();
   const download=await downloadPromise,path=screenshots+'/progress-'+width+'.json';await download.saveAs(path);
   const backup=JSON.parse(fs.readFileSync(path,'utf8'));assert.equal(Object.keys(backup.state.records).length,1);
   assert.equal(backup.format,'m1racle-anki-progress-v1');assert.equal(backup.packageHash.length,64);
   await frame.locator('#undo').click();await page.waitForFunction(()=>document.querySelector('.anki-frame').contentDocument.querySelector('#counts').textContent.includes('已评分 0'));
   page.once('dialog',dialog=>dialog.accept());await frame.locator('#progress-file').setInputFiles(path);
   await page.waitForFunction(()=>document.querySelector('.anki-frame').contentDocument.querySelector('#status').textContent.includes('复习记录已导入'));
   assert.match(await frame.locator('#counts').innerText(),/已评分 1/);
   await page.reload();frame=page.frameLocator('.anki-frame');await frame.locator('#restore').click();
   await frame.locator('#front .m1-ic-mask').first().waitFor();assert.match(await frame.locator('#counts').innerText(),/已评分 1/);
   await page.screenshot({path:screenshots+'/anki-'+width+'.png'});
   const physicalNavigations=[];const recordNavigation=frame=>{if(frame===page.mainFrame())physicalNavigations.push(frame.url())};page.on('framenavigated',recordNavigation);
   await page.goto(new URL('physical/',base).href);await page.locator('#main').waitFor();
   await page.waitForFunction(()=>navigator.serviceWorker.controller?.scriptURL.endsWith('/physical/service-worker.js'));
   assert.match(await page.locator('body').innerText(),/体格/);await noOverflow(page);
   assert.equal(physicalNavigations.length,1,'first worker takeover must not force a page reload');page.off('framenavigated',recordNavigation);
   await page.screenshot({path:screenshots+'/physical-'+width+'.png'});
   await page.goto(new URL('account/',base).href);await page.locator('#sign-in-section').waitFor();assert.equal(await page.locator('#email').isVisible(),true);await noOverflow(page);
   assert.equal(errors.length,0,'page errors: '+errors.join('; '));
   console.log('PASS '+width+'px: home, quiz, map, courses auth state, embedded Anki, retained card, score, backup import/export, reload, physical, account, no overflow');
   await context.close();
  }
  // Explicitly mocked API, no credentials or production writes.
  const records={};let sequence=0;
  const context=await browser.newContext({viewport:{width:390,height:900}});
  await context.addInitScript(user=>localStorage.setItem('m1racle_cloud_auth_v1',JSON.stringify({access_token:'mock_access',refresh_token:'mock_refresh',user:{id:user,email:'test@example.com'},expires_at:Date.now()+86400000})),USER);
  await context.route('https://*.supabase.co/**',async route=>{
   const request=route.request(),url=new URL(request.url()),method=request.method();let status=200,data=[];
   if(method==='OPTIONS'){await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}});return;}
   if(url.pathname==='/auth/v1/user')data={id:USER,email:'test@example.com'};
   else if(url.pathname.endsWith('/study_course_catalog_groups'))data=groups;
   else if(url.pathname.endsWith('/study_course_catalog'))data=[lesson];
   else if(url.pathname.endsWith('/study_catalog_watch_progress')){
    if(method==='GET')data=Object.values(records);
    else{
     const payload=request.postDataJSON();
     if(method==='PATCH'&&url.searchParams.get('updated_at')!=='eq.'+records[lesson.id]?.updated_at)data=[];
     else{sequence++;const row={...records[lesson.id],...payload,updated_at:'2026-11-06T10:00:'+String(sequence).padStart(2,'0')+'.123456+00:00'};records[lesson.id]=row;data=[row];if(method==='POST')status=201;}
    }
   }
   await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  });
  const a=await context.newPage();await a.goto(base+'#/courses');await a.locator('.course-lesson').first().waitFor();await a.locator('.course-lesson').first().click();
  await a.locator('#course-position').fill('42:30');await a.locator('#course-save').click();await a.getByText('已保存到云端',{exact:false}).waitFor();assert.equal(records[lesson.id].position_seconds,2550);
  const b=await context.newPage();await b.goto(base+'#/courses');await b.locator('.course-lesson').first().click();assert.equal(await b.locator('#course-position').inputValue(),'42:30');
  await b.locator('#course-position').fill('45:00');await a.locator('#course-position').fill('43:20');await a.locator('#course-save').click();await a.getByText('已保存到云端',{exact:false}).waitFor();
  await b.locator('#course-save').click();await b.getByText('其他设备可能已修改此节进度',{exact:false}).waitFor();assert.equal(records[lesson.id].position_seconds,2600);assert.equal(await b.locator('#course-position').inputValue(),'45:00');
  console.log('PASS mocked course API: load, manual watch position save, second-page read and conflict preservation');await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
