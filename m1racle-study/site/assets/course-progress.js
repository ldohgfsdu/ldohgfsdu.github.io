/* M1racle Study v9 — TTSX course index with user-entered watch progress.
   No video content, Netdisk API, Netdisk links or inferred playback time.
   Authenticated reads and writes use the site's existing M1Cloud session and Supabase RLS. */
(()=>{
'use strict';
const CATALOG='ttsx-2027-basic-strengthening';
const cloud=()=>window.M1Cloud;
const state={userId:null,loading:false,loaded:false,saving:false,error:'',groups:[],lessons:[],progress:{},group:2,filter:'all',search:'',selected:null,draft:null,dirty:false,requestId:0,lastFetch:0};
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const getStatus=()=>cloud()?.status()||{};
const active=()=>!!getStatus().active;
const enc=encodeURIComponent;
const formatTime=seconds=>{
 if(seconds===null||seconds===undefined||!Number.isFinite(Number(seconds)))return '';
 const n=Math.floor(Number(seconds));if(n<0)return '';
 const h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
 return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`;
};
const parseTime=v=>{
 if(!String(v??'').trim())return null;
 const parts=String(v).trim().split(':');
 if(parts.length<2||parts.length>3||!parts.every(p=>/^\d+$/.test(p)))throw Error('时间格式应为 分:秒 或 时:分:秒，例如 42:30');
 const nums=parts.map(Number);
 if(nums.some(n=>!Number.isSafeInteger(n))||nums.slice(1).some(n=>n>59))throw Error('时间的分秒部分不能超过59');
 const secs=parts.length===2?nums[0]*60+nums[1]:nums[0]*3600+nums[1]*60+nums[2];
 if(!Number.isSafeInteger(secs)||secs>2147483647)throw Error('时间超出允许范围');
 return secs;
};
const pFor=id=>state.progress[id]||null;
const makeDraft=id=>{
 const p=pFor(id);
 return {status:p?.status||'not_started',position:formatTime(p?.position_seconds),duration:formatTime(p?.duration_seconds),note:p?.note||''};
};
function message(v,isError=false){const el=document.querySelector('#course-message');if(el){el.textContent=v;el.className='course-message'+(isError?' course-message-error':'')} }
function hasUnsaved(){return state.dirty&&state.selected}
function maybeDiscard(){return !hasUnsaved()||window.confirm('当前记录还没有保存，确定放弃修改吗？')}
function repaint(){if(location.hash.replace(/^#\/?/,'')==='courses'){
 const el=document.querySelector('#app-main');if(el)el.innerHTML=render();
}}
function choose(id){
 if(!maybeDiscard())return;
 const lesson=state.lessons.find(x=>x.id===id);if(!lesson)return;
 state.selected=id;state.group=lesson.group_no;state.draft=makeDraft(id);state.dirty=false;
 repaint();if(window.innerWidth<=850)document.querySelector('.course-detail-panel')?.scrollIntoView({block:'start'});
}
function discard(){if(!maybeDiscard())return;state.selected=null;state.draft=null;state.dirty=false;repaint()}
async function reload(force=false){
 if(!active()||state.loading||state.saving)return;
 if(!force&&state.loaded&&Date.now()-state.lastFetch<30000)return;
 const status=getStatus(),owner=status.userId;if(!owner)return;
 const id=++state.requestId;state.loading=true;state.error='';repaint();
 try{
  const root='/rest/v1/';
  const [groups,lessons,progress]=await Promise.all([
   cloud().req(`${root}study_course_catalog_groups?select=catalog_key,group_no,group_title,subject,lesson_type,listed_video_count,capture_status&catalog_key=eq.${CATALOG}&order=group_no.asc&limit=100`),
   cloud().req(`${root}study_course_catalog?select=id,group_no,lesson_no,study_order,display_title,verification_status,duration_seconds&catalog_key=eq.${CATALOG}&order=group_no.asc,study_order.asc&limit=500`),
   cloud().req(`${root}study_catalog_watch_progress?select=user_id,catalog_lesson_id,status,position_seconds,duration_seconds,note,completed_at,updated_at&user_id=eq.${enc(owner)}&limit=500`)
  ]);
  if(id!==state.requestId||getStatus().userId!==owner)return;
  if(!Array.isArray(groups)||!Array.isArray(lessons)||!Array.isArray(progress))throw Error('云端返回的数据格式不正确');
  state.groups=groups;state.lessons=lessons;state.progress=Object.fromEntries(progress.map(x=>[x.catalog_lesson_id,x]));
  state.loaded=true;state.userId=owner;state.lastFetch=Date.now();
  if(state.selected&&!state.lessons.some(x=>x.id===state.selected)){state.selected=null;state.draft=null;state.dirty=false;}
  if(state.selected&&!state.dirty)state.draft=makeDraft(state.selected);
 }catch(err){if(id===state.requestId)state.error=err.message||'无法读取课程目录，请稍后重试';}
 finally{if(id===state.requestId){state.loading=false;repaint()}}
}
function summary(){const total=state.lessons.length,lessonIds=new Set(state.lessons.map(x=>x.id)),values=Object.entries(state.progress).filter(([id])=>lessonIds.has(id)).map(([,p])=>p);const done=values.filter(p=>p.status==='completed').length;const watching=values.filter(p=>p.status==='watching').length;return {total,done,watching,notStarted:Math.max(0,total-done-watching)}}
function groupStats(g){const ls=state.lessons.filter(x=>x.group_no===g.group_no);return {total:ls.length,done:ls.filter(x=>pFor(x.id)?.status==='completed').length}}
function currentLesson(){return state.lessons.find(x=>x.id===state.selected)||null}
function statusLabel(v){return {'not_started':'未开始','watching':'观看中','completed':'已看完'}[v]||'未开始'}
function statusClass(v){return v==='completed'?'done':v==='watching'?'watching':''}
function htmlGroup(){return `<div class="course-filterbar">
  <label><span class="course-label">课程分类</span><select class="selector" id="course-group">${state.groups.map(g=>`<option value="${g.group_no}" ${state.group===g.group_no?'selected':''}>${escapeHTML(g.group_title)}</option>`).join('')}</select></label>
  <label><span class="course-label">学习状态</span><select class="selector" id="course-filter">${[['all','全部'],['not_started','未开始'],['watching','观看中'],['completed','已看完']].map(([v,t])=>`<option value="${v}" ${state.filter===v?'selected':''}>${t}</option>`).join('')}</select></label>
  <label class="course-search"><span class="course-label">搜索课程</span><input id="course-search" class="input" placeholder="查找课程名称" value="${escapeHTML(state.search)}" autocomplete="off"/></label>
 </div>`}
function htmlList(){
 const current=state.groups.find(g=>g.group_no===state.group)||state.groups[0];
 let lessons=state.lessons.filter(l=>l.group_no===state.group);
 const needle=state.search.trim().toLowerCase();
 if(needle)lessons=lessons.filter(l=>l.display_title.toLowerCase().includes(needle));
 if(state.filter!=='all')lessons=lessons.filter(l=>(pFor(l.id)?.status||'not_started')===state.filter);
 const s=current?groupStats(current):{total:0,done:0};
 return `<section class="course-list-panel"><div class="course-list-title"><div><h2>${escapeHTML(current?.group_title||'课程目录')}</h2><p>${s.done} / ${s.total} 节已看完。按实际教学顺序排列，文件编号仅用于寻找原视频。</p></div><span>${lessons.length} 节</span></div>
 <div class="course-lessons" role="list">${lessons.length?lessons.map(l=>{
  const p=pFor(l.id),st=p?.status||'not_started';
  return `<button type="button" role="listitem" class="course-lesson ${state.selected===l.id?'selected':''}" data-course-id="${escapeHTML(l.id)}" aria-label="第${l.study_order||l.lesson_no}节 ${escapeHTML(l.display_title)}，${statusLabel(st)}">
    <span class="course-lesson-order">${String(l.study_order||l.lesson_no).padStart(2,'0')}</span><span class="course-lesson-body"><strong>${escapeHTML(l.display_title)}</strong><small>${l.study_order&&l.study_order!==l.lesson_no?`网盘原编号 ${l.lesson_no} · `:''}${p?.position_seconds!==null&&p?.position_seconds!==undefined?`上次看到 ${formatTime(p.position_seconds)}`:'未记录观看时间'}</small></span><span class="course-lesson-status ${statusClass(st)}">${statusLabel(st)}</span>
   </button>`}).join(''):'<p class="course-empty">当前筛选条件下没有课程。</p>'}</div></section>`;
}
function htmlDetail(){
 const l=currentLesson();if(!l)return `<aside class="course-detail-panel course-detail-empty"><h2>选择一节课</h2><p>从左侧课程目录选择课程，记录在百度网盘里看到的时间。这里不播放或下载视频。</p></aside>`;
 const p=pFor(l.id),d=state.draft||makeDraft(l.id);
 const group=state.groups.find(g=>g.group_no===l.group_no);
 return `<section class="course-detail-panel"><button class="course-back" id="course-back" type="button">← 返回课程目录</button><p class="course-kicker">${escapeHTML(group?.group_title||'录播课')} · 第${l.study_order||l.lesson_no}节</p>
  <h2>${escapeHTML(l.display_title)}</h2><p class="course-detail-meta">${l.study_order&&l.study_order!==l.lesson_no?`网盘原编号 ${l.lesson_no} · `:''}仅记录个人观看位置，不同步百度网盘播放历史</p>
  <form id="course-progress-form" class="course-form" autocomplete="off">
    <label class="course-field"><span>观看状态</span><select id="course-status" class="selector"><option value="not_started" ${d.status==='not_started'?'selected':''}>未开始</option><option value="watching" ${d.status==='watching'?'selected':''}>观看中</option><option value="completed" ${d.status==='completed'?'selected':''}>已看完</option></select></label>
    <div class="course-time-fields"><label class="course-field"><span>目前看到</span><input id="course-position" class="input" inputmode="text" placeholder="42:30" value="${escapeHTML(d.position)}" aria-describedby="course-time-help"/></label><label class="course-field"><span>视频总时长（选填）</span><input id="course-duration" class="input" inputmode="text" placeholder="1:35:00" value="${escapeHTML(d.duration)}"/></label></div>
    <p class="course-help" id="course-time-help">支持 42:30 或 1:02:30，不要求填写视频总时长。</p>
    <label class="course-field"><span>备注（选填）</span><textarea id="course-note" maxlength="1000" rows="3" placeholder="例如：心肌电活动后半段要再听一遍">${escapeHTML(d.note)}</textarea></label>
    <button id="course-save" type="submit" class="btn" ${state.saving?'disabled':''}>${state.saving?'正在保存…':'保存观看进度'}</button>
    <div id="course-message" class="course-message" role="status" aria-live="polite">${state.dirty?'尚未保存修改':p?.updated_at?'上次保存：'+escapeHTML(new Date(p.updated_at).toLocaleString('zh-CN')):'这节课还没有保存过记录'}</div>
  </form><p class="course-small-note">${l.verification_status==='needs_review'?'课程标题有待人工复核；不影响进度记录。':'课程名称源自已整理的网盘目录。'}保存后可在使用同一账号的设备上查看。观看完成不代表知识已经掌握。</p></section>`;
}
function render(){
 const st=getStatus(),s=summary();
 let body='';
 if(!st.configured)body='<section class="course-gate"><h2>云端尚未配置</h2><p>本功能需要已配置的 M1racle Study 账号同步。</p><a class="btn" href="account/">进入账号设置</a></section>';
 else if(st.mode==='migration')body='<section class="course-gate"><h2>先完成旧记录迁移</h2><p>为了避免不同账号的学习进度混用，请先在账号页面完成迁移选择。</p><a class="btn" href="account/">处理账号记录</a></section>';
 else if(!st.active)body='<section class="course-gate"><h2>登录后查看完整课表</h2><p>已有205节 TTSX 基础强化课程目录；观看记录只属于你的账号，登录后可跨设备同步。</p><a class="btn" href="account/">前往邮箱登录</a></section>';
 else if(state.loading&&!state.loaded)body='<section class="course-gate"><h2>正在加载课程目录</h2><p>读取课程和个人观看进度…</p></section>';
 else if(state.error&&!state.loaded)body=`<section class="course-gate"><h2>暂时无法读取课程</h2><p>${escapeHTML(state.error)}</p><button class="btn" id="course-retry">重新加载</button></section>`;
 else if(!state.loaded)body='<section class="course-gate"><h2>正在准备课程</h2><p>正在检查当前账号的学习记录。</p></section>';
 else body=`<div class="course-stat-row"><div><strong>${s.total}</strong><span>课程总数</span></div><div><strong>${s.done}</strong><span>已看完</span></div><div><strong>${s.watching}</strong><span>观看中</span></div><div><strong>${s.notStarted}</strong><span>未开始</span></div></div>
  <div class="course-action-row"><p>完成度 <b>${s.total?Math.round(s.done/s.total*100):0}%</b> · 仅统计观看状态，不等于知识掌握率。</p><button id="course-refresh" type="button" class="btn outline small" ${state.saving||state.loading?'disabled':''}>${state.loading?'同步中…':'刷新云端记录'}</button></div>
  ${htmlGroup()}${state.error?`<p class="course-message course-message-error">${escapeHTML(state.error)}</p>`:''}
  <div class="course-workspace ${state.selected?'detail-open':''}">${htmlList()}${htmlDetail()}</div>`;
 return `<div class="main-content course-page"><div class="page-heading"><h1>录播课程</h1><p>TTSX 2027 · 基础强化课。自己记录看到哪里，网站只管理学习进度，不保存或播放视频。</p></div>${body}</div>`;
}
async function save(e){
 e.preventDefault();if(!active()||!state.selected||state.saving||!state.draft)return;
 const l=currentLesson();if(!l)return;
 let pos,duration;try{
  pos=parseTime(state.draft.position);duration=parseTime(state.draft.duration);
  if(duration===0)throw Error('视频总时长应大于0');
  if(pos!==null&&duration!==null&&pos>duration)throw Error('已观看位置不能超过视频总时长');
 }catch(err){message(err.message,true);return}
 const old=pFor(l.id),d=state.draft;
 const status=d.status;
 if(status==='not_started'){pos=null;duration=null;}
 const owner=getStatus().userId;
 const payload={status,position_seconds:pos,duration_seconds:duration,note:d.note.trim(),completed_at:status==='completed'?(old?.completed_at||new Date().toISOString()):null,updated_at:new Date().toISOString()};
 state.saving=true;const button=document.querySelector('#course-save');if(button){button.disabled=true;button.textContent='正在保存…'}
 message('正在保存到云端…');
 try{
  let rows;
  if(old){
   const url=`/rest/v1/study_catalog_watch_progress?user_id=eq.${enc(owner)}&catalog_lesson_id=eq.${enc(l.id)}&updated_at=eq.${enc(old.updated_at)}&select=*`;
   rows=await cloud().req(url,'PATCH',payload,{'Prefer':'return=representation'});
   if(!Array.isArray(rows)||rows.length!==1)throw Error('其他设备可能已修改此节进度。请刷新云端记录后核对，当前输入还未覆盖云端。');
  }else{
   rows=await cloud().req('/rest/v1/study_catalog_watch_progress?select=*','POST',{user_id:owner,catalog_lesson_id:l.id,...payload},{'Prefer':'return=representation'});
   if(!Array.isArray(rows)||rows.length!==1)throw Error('记录保存后未收到确认，请刷新页面核实。');
  }
  if(getStatus().userId!==owner)throw Error('账号已切换，请重新查看学习记录');
  state.progress[l.id]=rows[0];state.draft=makeDraft(l.id);state.dirty=false;state.error='';state.lastFetch=0;
  repaint();message('已保存到云端。手机和电脑登录同一账号后可查看。');
 }catch(err){message(err.status===409?'云端已经存在这节课的记录，请刷新后再编辑。':(err.message||'保存失败，当前修改尚未写入云端。'),true)}
 finally{state.saving=false;const b=document.querySelector('#course-save');if(b){b.disabled=false;b.textContent='保存观看进度'}}
}
function attach(){
 window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue=''}});
 document.addEventListener('click',e=>{
  const a=e.target.closest('[data-course-id],#course-back,#course-refresh,#course-retry');if(!a)return;
  if(a.dataset.courseId){choose(a.dataset.courseId);return}
  if(a.id==='course-back'){discard();return}
  if(a.id==='course-refresh'||a.id==='course-retry'){
   if(hasUnsaved()&&!maybeDiscard())return;
   state.dirty=false;reload(true);
  }
 });
 document.addEventListener('submit',e=>{if(e.target?.id==='course-progress-form')save(e)});
 document.addEventListener('change',e=>{
  if(e.target.id==='course-group'){
   if(!maybeDiscard()){e.target.value=String(state.group);return}
   state.group=Number(e.target.value);state.selected=null;state.draft=null;state.dirty=false;repaint();
  }
  if(e.target.id==='course-filter'){state.filter=e.target.value;repaint()}
  if(e.target.id==='course-status'&&state.draft){state.draft.status=e.target.value;state.dirty=true;message('尚未保存修改')}
 });
 document.addEventListener('input',e=>{
  if(e.target.id==='course-search'){
   const text=e.target.value,pos=e.target.selectionStart;state.search=text;repaint();const fresh=document.querySelector('#course-search');if(fresh){fresh.focus();fresh.setSelectionRange(pos,pos)}
  }
  const field={'course-position':'position','course-duration':'duration','course-note':'note'}[e.target.id];
  if(field&&state.draft){
   state.draft[field]=e.target.value;
   if(field==='position'&&state.draft.status==='not_started'&&e.target.value.trim()){
    state.draft.status='watching';const sel=document.querySelector('#course-status');if(sel)sel.value='watching';
   }
   state.dirty=true;message('尚未保存修改');
  }
 });
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&location.hash.includes('/courses')&&!state.dirty)reload()});
 window.addEventListener('online',()=>{if(location.hash.includes('/courses')&&!state.dirty)reload(true)});
 cloud()?.subscribe(s=>{
  if(!s.active){
   if(state.userId||state.loaded){state.userId=null;state.loaded=false;state.lessons=[];state.groups=[];state.progress={};state.selected=null;state.draft=null;state.dirty=false;state.requestId++;}
   repaint();return;
  }
  if(state.userId&&state.userId!==s.userId){state.loaded=false;state.lessons=[];state.progress={};state.selected=null;state.draft=null;state.dirty=false;state.requestId++;}
  if(!state.loaded&&!state.loading)reload(true);
 });
}
window.M1Courses={render,reload,formatTime,parseTime,summary,canLeave:()=>{if(!maybeDiscard())return false;state.dirty=false;return true}};
attach();
})();
