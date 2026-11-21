import {createHash} from 'node:crypto';
import {readdir,readFile,writeFile} from 'node:fs/promises';

const files=(await readdir('dist',{recursive:true,withFileTypes:true}))
 .filter(entry=>entry.isFile()&&entry.name!=='sw.js')
 .map(entry=>entry.parentPath.replace(/^dist[\\/]?/,'').split(/[\\/]/).filter(Boolean).concat(entry.name).join('/')).sort();
const hash=createHash('sha256');
for(const file of files)hash.update(await readFile('dist/'+file));
const name='groceries-'+hash.digest('hex').slice(0,16);
await writeFile('dist/sw.js',`
const cacheName=${JSON.stringify(name)};
const scope=new URL(self.registration.scope);
const shell=new Map(${JSON.stringify(files)}.map(file=>[new URL(file,scope).href,file]));
self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll([...shell.keys()])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 for(const key of await caches.keys())if(key.startsWith('groceries-')&&key!==cacheName)await caches.delete(key);
 await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
 const request=event.request;
 const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==scope.origin)return;
 if(request.mode==='navigate'&&[scope.pathname,scope.pathname+'index.html'].includes(url.pathname)){
  if(url.search||url.hash)return;
  event.respondWith((async()=>{const cache=await caches.open(cacheName);try{const live=await fetch(request,{cache:'no-cache'});if(live.ok&&(await live.clone().text()).includes(scope.pathname+'assets/'))return live;}catch{}return (await cache.match(new URL('index.html',scope)))||Response.error();})());
 }else if(shell.has(url.href)){
  event.respondWith(caches.open(cacheName).then(cache=>cache.match(request)).then(response=>response||fetch(request)));
 }
});
`);
