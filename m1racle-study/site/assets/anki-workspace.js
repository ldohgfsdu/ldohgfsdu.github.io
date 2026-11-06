/* Keep the validated reviewer mounted so route changes retain the active card. */
(()=>{
 'use strict';
 let frame=null;
 function show(){
  const host=document.getElementById('anki-workspace');
  if(!host||frame)return;
  const heading=document.createElement('div');heading.className='page-heading';
  heading.innerHTML='<h1 id="anki-heading">Anki复习 <span class="anki-local-label">本机资料 · 未云同步</span></h1><p class="anki-intro">在这里导入卡包、逐条或全部揭晓答案，再用四档评分安排下次复习。离开此页查看课程后，当前卡片会保留；课程进度与 Anki 复习进度分别记录。</p>';
  frame=document.createElement('iframe');frame.className='anki-frame';frame.title='Anki 卡包导入与复习';
  frame.src='anki/';
  host.append(heading,frame);
 }
 window.addEventListener('message',event=>{
  if(!frame||event.origin!==location.origin||event.source!==frame.contentWindow||event.data?.type!=='m1racle:anki-height')return;
  const h=Number(event.data.height);
  if(Number.isFinite(h)&&h>=100&&h<=30000)frame.style.height=Math.ceil(h+8)+'px';
 });
 window.M1Anki={show};
})();
