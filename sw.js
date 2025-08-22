
const CACHE_NAME='skyx-cache-v8';
const ASSETS=['./','./index.html','./styles.css','./app.js','./manifest.json','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./assets/Skyx_Favicon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))))});
self.addEventListener('fetch',e=>{const url=new URL(e.request.url); if(url.origin===location.origin){ e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request))); }});
