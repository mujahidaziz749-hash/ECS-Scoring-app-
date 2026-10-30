/* Cricket Apps - offline support (service worker).
   Pehli dafa net ke saath khulne par saari apps phone mein save ho jati hain;
   uske baad bina internet ke bhi khulti hain. Firebase/login ki requests ko ye chhoota nahi. */
const V = 'cricket-v14';
const CORE = [
  'index.html',
  'RSL_Scoring_App_Connected.html', 'JSL_Scoring_App_Connected.html', 'ECS_System_Connected.html',
  'manifest-home.json', 'manifest-rsl.json', 'manifest-jsl.json', 'manifest-ecs.json',
  'icon-home-192.png', 'icon-home-512.png', 'icon-rsl-192.png', 'icon-rsl-512.png',
  'icon-jsl-192.png', 'icon-jsl-512.png', 'icon-ecs-192.png', 'icon-ecs-512.png'
];
const key = u => { const x = new URL(u, self.location); return x.origin + x.pathname; };

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    for (const u of CORE) {                       // sab ya kuch nahi: koi file na mili to install fail, agli dafa dobara koshish
      const r = await fetch(u, { cache: 'reload' });
      if (!r.ok) throw new Error('precache fail: ' + u);
      await c.put(key(u), r);
    }
    const idx = await c.match(key('index.html'));  // scope ka root bhi index se khule
    if (idx) await c.put(key('./'), idx.clone());
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k.startsWith('cricket-')) await caches.delete(k);
    await self.clients.claim();
  })());
});

async function netFirst(req) {
  const c = await caches.open(V), k = key(req.url);
  const hit = await c.match(k);
  const net = fetch(req).then(res => { if (res && res.ok) c.put(k, res.clone()); return res; });
  if (!hit) { try { return await net; } catch (_) { const idx = await c.match(key('index.html')); return idx || Response.error(); } }
  net.catch(() => {});
  // net slow ho to 3 second baad saved copy dikhao
  return Promise.race([net.catch(() => hit), new Promise(r => setTimeout(() => r(hit), 3000))]);
}
async function cacheFirst(req) {
  const c = await caches.open(V), k = key(req.url);
  const hit = await c.match(k); if (hit) return hit;
  const res = await fetch(req); if (res && (res.ok || res.type === 'opaque')) c.put(k, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === self.location.origin) {
    const isDoc = r.mode === 'navigate' || u.pathname.endsWith('.html') || u.pathname.endsWith('/');
    e.respondWith(isDoc ? netFirst(r) : cacheFirst(r));
    return;
  }
  // photo cut-out (mediapipe) files: pehli dafa online use hone par save ho jati hain
  if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('/@mediapipe/')) { e.respondWith(cacheFirst(r)); return; }
  // baaqi sab (Firebase, login, etc.) seedha network par
});

/* Notification par tap: app khol do / aage le aao */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
