/* M1racle Study v10 offline shell. Updates activate only after the user's update action. */
const CACHE='m1racle-physical-v10.0.0';
const FILES=['/physical/','/physical/index.html','/physical/manifest.webmanifest','/physical/icon.svg','/physical/icon.png','/physical/icon-512.png','/physical/brand-mark.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('m1racle-physical-v')&&k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('message',event=>{if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{const r=event.request;if(r.method!=='GET'||new URL(r.url).origin!==self.location.origin)return;
 event.respondWith(fetch(r).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(r,copy)).catch(()=>{})}return response}).catch(()=>caches.match(r).then(c=>c||caches.match('/physical/index.html'))));
});
