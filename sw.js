/* LearnEasyly offline shell v2: never serve HTML in place of JS/CSS/assets. */
const CACHE="learneasyly-shell-v2";
const SHELL=["./","./index.html","./styles.css","./app.js","./icon.svg","./manifest.webmanifest"];
self.addEventListener("install",(event)=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate",(event)=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&k.startsWith("learneasyly-shell-")).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",(event)=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  const scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  event.respondWith((async()=>{
    try {
      const response=await fetch(event.request);
      if(response.ok){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)).catch(()=>{}));
      }
      return response;
    }catch(err){
      const cached=await caches.match(event.request);
      if(cached)return cached;
      if(event.request.mode==="navigate"){
        const fallback=await caches.match("./index.html");
        if(fallback)return fallback;
      }
      return Response.error();
    }
  })());
});