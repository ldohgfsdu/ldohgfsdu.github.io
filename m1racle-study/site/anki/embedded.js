/* Same-origin host integration; no learning data or auth tokens are messaged. */
(()=>{
 if(window.parent===window)return;
 document.documentElement.classList.add('m1-embedded');
 const style=document.createElement('style');
 style.textContent='.m1-embedded{color-scheme:light;--bg:transparent;--card:#fff;--fg:#202425;--muted:#626b6f;--line:#d7dcdf;--main:#185db4}.m1-embedded body{background:transparent}.m1-embedded main{max-width:none;margin:0;padding:0 0 12px}.m1-embedded main>header,.m1-embedded main>.notice{display:none}.m1-embedded .panel{box-shadow:none;border-radius:12px;margin:0 0 16px}.m1-embedded h2{font-size:16px}';
 document.head.append(style);
 let pending=false,last=0;
 function size(){
  pending=false;
  const main=document.querySelector('main');if(!main)return;
  const height=Math.ceil(main.getBoundingClientRect().height);
  if(height===last)return;last=height;
  window.parent.postMessage({type:'m1racle:anki-height',height},location.origin);
 }
 function queue(){if(!pending){pending=true;requestAnimationFrame(size);}}
 new ResizeObserver(queue).observe(document.querySelector('main'));
 window.addEventListener('load',queue);window.addEventListener('resize',queue);queue();
})();
