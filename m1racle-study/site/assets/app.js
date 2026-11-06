/* M1racle Study v10 | local-first learning app with optional authenticated cloud sync. */
(()=>{
'use strict';
const {q:bank,map:catalog}=window.STUDY_DATA || {};
const QUESTIONS=bank?.questions||[];
const CATS=bank?.categories||[];
const PARTS=catalog?.parts||[];
const PHYS_KEY='phys_exam_lab_2025_v1';
const KEY='m1racle_study_platform_v1';
const initial=()=>({answered:{},wrong:{},starred:{},sessions:[],lastModule:'physical'});
const load=()=>{try{let o=JSON.parse(localStorage.getItem(KEY)||'{}');return {...initial(),...o,answered:o.answered||{},wrong:o.wrong||{},starred:o.starred||{},sessions:o.sessions||[]}}catch(e){return initial()}};
let saved=load();
let ui={view:'home',session:null,filter:'all',limit:10,wrongOnly:false,activePart:'part3',search:'',scale:1};
const E=(s)=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const $=sel=>document.querySelector(sel);
const qs=sel=>Array.from(document.querySelectorAll(sel));
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(saved));window.M1Cloud?.localSave('platform',saved)}catch(err){toast('存储失败，请检查浏览器空间设置')}};
const fmtDate=()=>new Date().toLocaleDateString('zh-CN');
let toastTimer=null;
function toast(msg){let e=$('#toast');e.textContent=msg;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),2400)}
function physicalProgress(){try{let d=JSON.parse(localStorage.getItem(PHYS_KEY)||'{}');let mastery=d.mastery||{};return Object.values(mastery).filter(x=>Number(x)===2).length}catch(e){return 0}}
function nav(view){if(ui.view==='courses'&&view!=='courses'&&!window.M1Courses?.canLeave?.())return;if(ui.session&&ui.view!==view){finishQuiz();ui.session=null}location.hash='#/'+view;render()}
function currentRoute(){let h=location.hash.replace(/^#\/?/,'');return ['home','courses','anki','questions','mindmaps'].includes(h)?h:'home'}
function partById(id){return PARTS.find(x=>x.id===id)||PARTS[2]||PARTS[0]}
function sourceTag(q){let p=q.source;return `体格检查 ${q.item}：昭昭 P${p.pageStart}${p.pageEnd===p.pageStart?'':'–'+p.pageEnd}；PDF ${p.pdfPageStart}${p.pdfPageEnd===p.pdfPageStart?'':'–'+p.pdfPageEnd}`}
function sectionHeading(title,desc,eyebrow){return `<div class="page-heading"><h1>${title}</h1>${desc?`<p>${desc}</p>`:""}</div>`}
function setNavActive(){
 qs('[data-view]').forEach(btn=>{let a=btn.dataset.view===ui.view;btn.classList.toggle('active',a);btn.setAttribute('aria-current',a?'page':'false')});
 $('#crumb').textContent='M1racle Study / '+({home:'首页',courses:'录播课程',anki:'Anki复习',questions:'刷题中心',mindmaps:'思维导图'}[ui.view]||'首页');
}
function home(){
 const mastered=physicalProgress();const all=QUESTIONS.length;
 const attempts=saved.sessions.length;const answered=Object.keys(saved.answered).length;
 return `<div class="main-content">
 <section class="hero"><h1>开始学习</h1><p>选择一个模块，继续上次的进度。</p><div class="hero-actions"><button class="btn light" data-view="courses">继续录播课程</button><a href="physical/" class="btn outline">体格检查</a><button class="btn outline" data-view="questions">开始刷题</button></div></section>
 <div class="modules-top"><h2>学习模块</h2></div>
 <section class="module-grid" aria-label="学习模块">
   <button class="module-card" data-view="courses"><h3>录播课程</h3><p>TTSX 2027 基础强化课，按章节顺序记录观看位置。</p><div class="card-action">205 节目录</div></button>
   <a class="module-card phys" href="physical/"><h3>体格检查</h3><p>66项考点，含动作、口述、评分、复习和笔记。</p><div class="card-action"><span>已掌握 ${mastered}/66</span></div></a>
   <button class="module-card anki" data-view="anki"><h3>Anki复习</h3><p>导入自己的卡包，原位揭晓答案，按到期队列复习。</p><div class="card-action"><span>本机卡包与复习记录</span></div></button>
   <button class="module-card quiz" data-view="questions"><h3>刷题中心</h3><p>${all}道自编复习题，按分区练习、看解析、复习错题。</p><div class="card-action"><span>已练 ${answered}/${all} 题</span></div></button>
   <button class="module-card map" data-view="mindmaps"><h3>思维导图</h3><p>《诊断学（第10版）》目录结构检索及章节定位。</p><div class="card-action"><span>${PARTS.length}篇目录</span></div></button>
 </section>
 <section class="stat-strip" aria-label="本机学习数据"><div class="stat"><b>${mastered}<small> / 66</small></b><span>已掌握考点</span></div><div class="stat"><b>${answered}<small> / ${all}</small></b><span>已练习题目</span></div><div class="stat"><b>${attempts}</b><span>刷题场次</span></div></section>
 <section class="surface" aria-label="资料来源"><h3>资料来源</h3>
  <div class="source-line"><div><b>昭昭实践技能（2025）</b><p>体格检查66项考点，附教材页码。</p></div></div>
  <div class="source-line"><div><b>助理全身体格检查、2020年校赛评分表</b><p>作为操作口述与历史评分参考，具体来源独立标注。</p></div></div>
  <div class="source-line"><div><b>《诊断学（第10版）》</b><p>用于章节目录结构，不公开原书全文。</p></div></div>
 </section>
 </div>`;
}
function filteredPool(){let arr=QUESTIONS.filter(q=>ui.filter==='all'||q.cat===ui.filter);if(ui.wrongOnly){arr=arr.filter(q=>saved.wrong[q.id])}return arr}
function renderQuizSetup(){
 const available=filteredPool().length;
 const activeWrong=Object.keys(saved.wrong).filter(k=>saved.wrong[k]).length;
 const answered=Object.keys(saved.answered).length;
 return `${sectionHeading('刷题中心','现有42道体格检查自编复习题，非教材原题。','QUESTION BANK')}
 <div class="quiz-setup"><section class="surface"><h3 style="margin:9px 0 5px">创建一轮练习</h3><p class="small muted">按分区或错题练习，交卷后查看解析与来源。</p>
 <label class="setup-label" for="cat-select">练习范围</label><select id="cat-select" class="selector" style="width:100%"><option value="all">全部体格检查 · 42题</option>${CATS.map(c=>`<option value="${c.id}" ${ui.filter===c.id?'selected':''}>${E(c.name)}</option>`).join('')}</select>
 <label class="setup-label" for="limit-select">本轮题数</label><select id="limit-select" class="selector" style="width:100%"><option value="10" ${ui.limit===10?'selected':''}>10题 · 快速训练</option><option value="20" ${ui.limit===20?'selected':''}>20题 · 加强练习</option><option value="999" ${ui.limit===999?'selected':''}>全部可用题目</option></select>
 <label style="display:flex;align-items:center;gap:9px;margin:17px 0;color:#5e6e7a;font-size:13px"><input type="checkbox" id="only-wrong" ${ui.wrongOnly?'checked':''}/> 只练错题（${activeWrong}道）</label>
 <p class="small muted" id="pool-number">当前范围可用 ${available} 道</p>
 <button class="btn" id="start-practice" style="margin-top:18px;width:100%" ${!available?'disabled':''}>开始练习</button>
 </section><section class="surface"><h3 style="margin:9px 0 20px">题库进度</h3><div class="keyval"><span>可练习题目</span><b>${QUESTIONS.length}</b></div><div class="keyval"><span>已尝试题目</span><b>${answered}</b></div><div class="keyval"><span>当前错题</span><b>${activeWrong}</b></div><div class="keyval"><span>完成练习</span><b>${saved.sessions.length}轮</b></div>
 <div class="mini-bar"><i style="width:${QUESTIONS.length?answered/QUESTIONS.length*100:0}%"></i></div><p class="small muted">学习记录先保存在本机；登录后自动同步云端。题目 ID 保持稳定。</p>
 </section></div>`
}
function renderQuizQuestion(){
 const s=ui.session;const id=s.order[s.idx];const q=QUESTIONS.find(q=>q.id===id);if(!q)return renderQuizResult();
 const done=s.answers[id]!==undefined;const chosen=s.answers[id];const total=s.order.length;
 const num=s.idx+1;
 return `${sectionHeading('刷题中心','本轮练习依据选定的范围随机出题，答错会自动进入错题记录。','QUESTION BANK')}
 <div class="quiz-stage"><div class="progress-head"><span>第 ${num} / ${total} 题</span><span>当前正确 ${s.correct} 题</span></div><div class="progress-track"><i style="width:${(num-1+(done?1:0))/total*100}%"></i></div><section class="surface" style="margin-top:18px"><div class="question-source">${E(sourceTag(q))}</div><div class="quiz-question">${E(q.q)}</div><div class="choices">${q.options.map((option,i)=>`<button class="choice ${done&&i===q.answer?'correct':''} ${done&&i===chosen&&i!==q.answer?'wrong':''}" data-answer="${i}" ${done?'disabled':''}><span class="letter">${'ABCD'[i]||String(i+1)}</span><span>${E(option)}</span></button>`).join('')}</div>
 ${done?`<div class="answer-block"><strong>${chosen===q.answer?'✓ 回答正确':'需要复习'} · 正确答案 ${'ABCD'[q.answer]||q.answer+1}</strong><p>${E(q.why)}</p><p style="font-size:11px">来源：${E(sourceTag(q))}</p></div>`:''}
 <div class="quiz-buttons"><button class="btn outline small" id="exit-practice">结束本轮</button><span style="display:flex;align-items:center;gap:10px"><button class="btn outline small" id="star-question">${saved.starred[id]?'★ 已收藏':'☆ 收藏本题'}</button>${done?`<button class="btn" id="next-question">${num===total?'查看结果':'下一题'}</button>`:''}</span></div></section></div>`
}
function renderQuizResult(){const s=ui.session;const rate=s.order.length?Math.round(s.correct/s.order.length*100):0;return `${sectionHeading('练习结果','练习结果已保存到本机；登录后会自动同步。','SESSION COMPLETE')}<div class="surface" style="max-width:730px"><div style="display:flex;align-items:flex-end;gap:16px;margin:17px 0"><span class="result-number">${rate}%</span><span class="muted small" style="padding-bottom:11px">正确 ${s.correct} / ${s.order.length} 题</span></div><div class="progress-track" style="margin-bottom:19px"><i style="width:${rate}%"></i></div><div class="keyval"><span>错题数</span><b>${s.order.length-s.correct}</b></div><div class="keyval"><span>本轮题目</span><b>${s.order.length}</b></div><div class="quiz-buttons"><button class="btn outline" id="return-quiz">返回题库</button><button class="btn" id="repeat-wrong">复习错题</button></div></div>`}
function questionPage(){return `<div class="main-content">${ui.session?(ui.session.idx>=ui.session.order.length?renderQuizResult():renderQuizQuestion()):renderQuizSetup()}</div>`}
function startQuiz(){
 const pool=filteredPool().map(q=>q.id);if(!pool.length){toast('当前范围暂无可练习题目');return}
 const mixed=pool.map(v=>[v,Math.random()]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
 ui.session={order:mixed.slice(0,ui.limit),idx:0,answers:{},correct:0,logged:false};render();window.scrollTo({top:0,behavior:'smooth'})
}
function answer(n){const s=ui.session;if(!s)return;const id=s.order[s.idx];if(s.answers[id]!==undefined)return;const q=QUESTIONS.find(q=>q.id===id);s.answers[id]=n;if(n===q.answer){s.correct++;delete saved.wrong[id]}else{saved.wrong[id]=true}saved.answered[id]={selected:n,correct:n===q.answer,date:Date.now()};save();window.M1Cloud?.pushAttempt(id,n,n===q.answer);render()}
function finishQuiz(){const s=ui.session;if(!s||s.logged)return;s.logged=true;saved.sessions.unshift({id:(crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`),date:new Date().toISOString(),total:Object.keys(s.answers).length,correct:Object.keys(s.answers).filter(id=>{let q=QUESTIONS.find(q=>q.id===id);return q&&s.answers[id]===q.answer}).length});saved.sessions=saved.sessions.slice(0,60);save()}
function endQuiz(){const s=ui.session;if(s&&Object.keys(s.answers).length){finishQuiz()}ui.session=null;render();window.scrollTo({top:0})}
function nextQuestion(){const s=ui.session;if(!s)return;s.idx++;if(s.idx>=s.order.length)finishQuiz();render();window.scrollTo({top:0,behavior:'smooth'})}
function mapPage(){
 const selected=partById(ui.activePart);const term=ui.search.trim().toLowerCase();
 const visible=PARTS.filter(p=>!term||p.name.toLowerCase().includes(term)||p.chapters.some(c=>c.name.toLowerCase().includes(term)));
 const children=selected.chapters.filter(c=>!term||selected.name.toLowerCase().includes(term)||c.name.toLowerCase().includes(term));
 return `<div class="main-content">${sectionHeading('思维导图','按《诊断学（第10版）》目录组织。当前为章节索引，不是因果关系图。','KNOWLEDGE MAP')}
  <div class="map-tools"><div class="searchbox" style="flex:1;max-width:440px"><span>⌕</span><input id="map-search" placeholder="搜索篇名或章节，例如：肺功能、心电图" value="${E(ui.search)}" aria-label="搜索知识地图"/></div><div class="toolline"><button class="btn outline small" id="map-zoom-out" aria-label="缩小导图">−</button><span class="small muted" id="zoom-label">${Math.round(ui.scale*100)}%</span><button class="btn outline small" id="map-zoom-in" aria-label="放大导图">＋</button><button class="btn outline small" id="map-reset">重置</button></div></div>
  <section class="map-board"><div class="map-root">诊断学（第10版） <small>章节目录</small></div><div class="map-parts" style="font-size:${ui.scale}em">${visible.length?visible.map((p,i)=>`<button class="map-part ${selected.id===p.id?'active':''}" data-part="${p.id}" aria-pressed="${selected.id===p.id}"><span class="number">书内 P${p.page}</span><b>${E(p.name)}</b><small>${p.chapters.length}个章节／小节</small></button>`).join(''):'<div class="info-note">没有匹配的目录节点</div>'}</div></section>
  <section class="map-detail"><div class="detail-head"><div><h3>${E(selected.name)}</h3><p class="small muted">书内 P${selected.page} 起，${selected.chapters.length}个章节／小节</p></div>${selected.id==='part3'?'<a class="btn small" href="physical/">体格检查</a>':''}</div>
  <div class="chapter-grid">${children.length?children.map(c=>`<div class="chapter ${term&&c.name.toLowerCase().includes(term)?'map-filter-match':''}"><span>${E(c.name)}</span><span class="page">P${c.page}</span></div>`).join(''):'<div class="info-note">这个分支暂无匹配的章节</div>'}</div>
  <p class="map-bottom">来源：《诊断学（第10版）》目录，人民卫生出版社，2024年第10版。P为纸质教材页码；本图不附公开下载的PDF正文。</p></section>
  
 </div>`
}
function render(){ui.view=currentRoute();setNavActive();const isAnki=ui.view==='anki';$('#app-main').hidden=isAnki;$('#anki-workspace').hidden=!isAnki;if(isAnki){window.M1Anki?.show();return}let html=ui.view==='questions'?questionPage():ui.view==='mindmaps'?mapPage():ui.view==='courses'?(window.M1Courses?.render()||'<p>课程模块尚未加载</p>'):home();$('#app-main').innerHTML=html}
function exportState(){let blob=new Blob([JSON.stringify({name:'M1racle Study 平台学习记录',date:new Date().toISOString(),platform:saved,physical:null,scope:'仅导出平台题库记录；体格检查记录请在对应模块内另行导出'},null,2)],{type:'application/json'});let u=URL.createObjectURL(blob);let a=document.createElement('a');a.href=u;a.download='M1racle_Study_平台刷题记录_'+fmtDate().replaceAll('/','-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),700);toast('刷题记录已导出；体格检查记录需在其模块内单独导出')}
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-view],[data-answer],[data-part],#start-practice,#exit-practice,#next-question,#star-question,#repeat-wrong,#return-quiz,#map-zoom-in,#map-zoom-out,#map-reset,#data-button');if(!el)return;
 if(el.dataset.view){nav(el.dataset.view);return}
 if(el.dataset.answer!==undefined){answer(Number(el.dataset.answer));return}
 if(el.dataset.part){ui.activePart=el.dataset.part;render();return}
 switch(el.id){case 'start-practice':startQuiz();break;case 'exit-practice':endQuiz();break;case 'next-question':nextQuestion();break;
 case 'star-question':{let id=ui.session?.order[ui.session.idx];if(id){saved.starred[id]=!saved.starred[id];save();render()}break}
 case 'repeat-wrong':ui.session=null;ui.wrongOnly=true;render();startQuiz();break;
 case 'return-quiz':ui.session=null;render();break;
 case 'map-zoom-in':ui.scale=Math.min(1.35,Math.round((ui.scale+.1)*10)/10);render();break;
 case 'map-zoom-out':ui.scale=Math.max(.8,Math.round((ui.scale-.1)*10)/10);render();break;
 case 'map-reset':ui.scale=1;ui.search='';ui.activePart='part3';render();break;
 case 'data-button':exportState();break;
 }
});
document.addEventListener('change',e=>{if(e.target.id==='cat-select'){ui.filter=e.target.value;render()}if(e.target.id==='limit-select'){ui.limit=Number(e.target.value);render()}if(e.target.id==='only-wrong'){ui.wrongOnly=e.target.checked;render()}});
document.addEventListener('input',e=>{if(e.target.id==='map-search'){let pos=e.target.selectionStart;ui.search=e.target.value;let selected=partById(ui.activePart);if(ui.search&&!selected.name.includes(ui.search)&&!selected.chapters.some(c=>c.name.includes(ui.search))){let match=PARTS.find(p=>p.name.includes(ui.search)||p.chapters.some(c=>c.name.includes(ui.search)));if(match)ui.activePart=match.id}render();let n=$('#map-search');n.focus();n.setSelectionRange(pos,pos)}});
window.addEventListener('hashchange',()=>{if(ui.session){finishQuiz();ui.session=null}render();window.scrollTo({top:0,behavior:'smooth'})});

window.M1Cloud?.subscribe(state=>{const e=document.getElementById('cloud-status');if(e){e.textContent=window.M1Cloud.statusText();e.title=state.error||'进入账号与同步设置'}});
window.addEventListener('m1racle:remote-state',e=>{if(e.detail.scope!=='platform')return;saved={...initial(),...e.detail.state};render()});
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
render();
})();
