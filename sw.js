/* Service worker трекера BLOCK 3.

   Зачем он нужен, кроме установки значка:
   без него страница живёт только пока есть сеть. Данные-то лежат локально, но САМ ФАЙЛ
   приложения качается с сервера — в метро или при обрыве связи открыть трекер было нельзя.

   Стратегия намеренно «сеть вперёд, кэш в запас» (network-first), а НЕ наоборот:
   приложение обновляется часто, и человек не должен неделями сидеть на старой версии из кэша.
   Пока сеть есть — всегда свежая версия, а копия кладётся в кэш. Сети нет — отдаём копию.
   Так офлайн работает, но застрять на старом невозможно.
*/
const CACHE="block3-v1";
const SHELL=["./","./index.html","./manifest.json","./icon-192.png","./icon-512.png"];

self.addEventListener("install",e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}));
});

self.addEventListener("activate",e=>{
  // Чужие/старые кэши подчищаем, чтобы не копились между версиями.
  e.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    }catch(err){}
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",e=>{
  const req=e.request;
  if(req.method!=="GET")return;                       // записи не трогаем
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;        // firebase и прочее — мимо нас
  e.respondWith((async()=>{
    try{
      const fresh=await fetch(req);
      // Кладём свежую копию в запас (ошибки кэша не должны ломать загрузку).
      try{const c=await caches.open(CACHE);c.put(req,fresh.clone());}catch(err){}
      return fresh;
    }catch(err){
      const hit=await caches.match(req);
      if(hit)return hit;
      // Навигация без сети и без копии — отдаём хотя бы страницу приложения.
      if(req.mode==="navigate"){
        const idx=await caches.match("./index.html");
        if(idx)return idx;
      }
      throw err;
    }
  })());
});

// Кнопка «Обновить приложение» просит стереть кэш — выполняем и отвечаем.
self.addEventListener("message",e=>{
  if(e.data==="clear-cache"){
    e.waitUntil((async()=>{
      try{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}catch(err){}
      try{e.source&&e.source.postMessage("cache-cleared");}catch(err){}
    })());
  }
});
