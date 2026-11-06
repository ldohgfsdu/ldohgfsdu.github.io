const CACHE='m1racle-platform-v10.0.0';
const SHELL=['/','/index.html','/assets/style.css','/assets/cloud-config.js','/assets/cloud-sync.js','/account/','/assets/data.js','/assets/app.js','/assets/course-progress.js','/assets/anki-workspace.js','/assets/question-bank.json','/assets/diagnostics-map.json','/brand-mark.png','/icon.png','/icon-512.png','/manifest.webmanifest','/anki/','/anki/index.html','/anki/review-core.js','/anki/embedded.js','/anki/vendor/fsrs.js','/anki/vendor/fzstd.js','/anki/vendor/jszip.min.js','/anki/vendor/sql-wasm.js','/anki/vendor/sql-wasm.wasm','/anki/vendor/noble/sha2.js','/anki/vendor/noble/_md.js','/anki/vendor/noble/_u64.js','/anki/vendor/noble/utils.js'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));self.skipWaiting();
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('m1racle-platform-v')&&key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim();
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==location.origin||url.pathname.endsWith('/assets/cloud-config.js')||request.mode==='navigate'&&url.pathname.startsWith('/physical/'))return;
 event.respondWith(fetch(request).then(response=>{
  if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});}
  return response;
 }).catch(async()=>{
  const cached=await caches.match(request);if(cached)return cached;
  if(request.mode!=='navigate')return Response.error();
  const fallback=url.pathname.startsWith('/anki/')?'/anki/index.html':url.pathname.startsWith('/account/')?'/account/':'/index.html';
  return await caches.match(fallback)||Response.error();
 }));
});
