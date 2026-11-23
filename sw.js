/* رتّل — service worker: offline support */
const CORE='rattil-core-v1', AUDIO='rattil-audio-v1';
const CORE_FILES=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CORE).then(c=>c.addAll(CORE_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CORE&&k!==AUDIO).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function rangeFrom(req,res){
  const range=req.headers.get('range'); if(!range) return res;
  const buf=await res.arrayBuffer(), size=buf.byteLength;
  const m=/bytes=(\d*)-(\d*)/.exec(range); if(!m) return new Response(buf,{status:200,headers:res.headers});
  let start=m[1]===''?size-Number(m[2]):Number(m[1]); let end=m[2]===''||m[1]===''?size-1:Number(m[2]);
  start=Math.max(0,start); end=Math.min(size-1,end);
  if(start>end) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(buf.slice(start,end+1),{status:206,headers:{'Content-Type':res.headers.get('Content-Type')||'audio/mpeg','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}

self.addEventListener('fetch',e=>{
  const req=e.request, url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin) return;
  if(url.pathname.includes('/audio/')){
    e.respondWith((async()=>{
      const c=await caches.open(AUDIO), key=url.pathname.split('/audio/')[0]+'/audio/'+url.pathname.split('/audio/')[1];
      let res=await c.match(key);
      if(!res){ try{ const net=await fetch(key); if(net.ok){ await c.put(key,net.clone()); res=net; } else return net; }catch(err){ return new Response('',{status:504}); } }
      return rangeFrom(req,res);
    })());
    return;
  }
  if(req.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/')){
    e.respondWith(fetch(req).then(r=>{ const cp=r.clone(); caches.open(CORE).then(c=>c.put('./index.html',cp)); return r; }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req)));
});
