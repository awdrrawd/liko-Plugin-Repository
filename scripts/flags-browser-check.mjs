// Browser regression fixture: node scripts/flags-browser-check.mjs, open localhost:8794.
// Local deterministic SVGs isolate UI / decoding from CDN availability.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const engine = await readFile(new URL('../Plugins/expand/BC_i18n.js', import.meta.url), 'utf8');
const page = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Flags regression</title>
<style>body{font:20px sans-serif;background:#fafafa;padding:30px}select,button{font:inherit;margin:12px}#result{white-space:pre-wrap}canvas{border:1px solid #888}</style>
<h1>SVG 國旗測試</h1><div id="label"></div><div id="failed"></div>
<select id="select" aria-label="Language"><option value="tw">🇹🇼 繁體中文</option><option value="jp">🇯🇵 日本語</option><option value="ca">🇨🇦 Failed image fallback</option></select>
<canvas id="canvas" width="100" height="80"></canvas><pre id="result">Running…</pre>
<script>
let downloads=0; const nativeFetch=window.fetch;const live=new URLSearchParams(location.search).has('live');
window.fetch=async (url,options)=>{downloads++;if(live)return nativeFetch(url,options);return new Response(url.includes('/ca.svg') ? '<svg xmlns="http://www.w3.org/2000/svg"><broken>' : '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"><path fill="#d33" d="M0 0h640v480H0z"/><path fill="#237" d="M0 0h320v240H0z"/></svg>',{status:200})};
</script><script src="/engine.js"></script><script>
const wait=async fn=>{for(let i=0;i<150;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Timed out');};
const check=(ok,text)=>{if(!ok)throw Error(text);};
(async()=>{
 const f=window.Liko.__Sys_Flags__;
 if(live){
   const results=await f.preload(Object.keys(f.languageCountries));
   const failed=results.filter(r=>r.status==='rejected');
   document.getElementById('result').textContent='CDN: '+(results.length-failed.length)+' / '+results.length+' downloaded; requests='+downloads+'; '+failed.map(r=>r.reason.message).join(', ');
   for(const country of Object.values(f.languageCountries)){const row=document.createElement('div');const emoji=[...country].map(c=>String.fromCodePoint(c.charCodeAt(0)-97+0x1F1E6)).join('');f.renderLabel(row,emoji+' '+country);document.body.append(row);}
   return;
 }
 await f.ready;check(downloads===11,'11 initial downloads');
 const label=document.getElementById('label');
 f.renderLabel(label,'🇹🇼 Old');f.renderLabel(label,'🇯🇵 Current');
 await wait(()=>label.querySelector('img'));check(label.textContent===' Current','stale label ignored');
 const failed=document.getElementById('failed');f.renderLabel(failed,'🇨🇦 Fallback');
 await wait(()=>f.status('ca')==='error');check(failed.textContent==='🇨🇦 Fallback','fallback kept on invalid SVG');
 const select=document.getElementById('select');let changes=0;select.addEventListener('change',()=>changes++);
 f.bindSelect(select);await wait(()=>select.style.backgroundImage.includes('blob:'));
 select.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 await wait(()=>document.querySelector('[role=listbox] img'));
 const menu=document.querySelector('[role=listbox]');check(menu,'picker open');
 menu.querySelectorAll('button')[1].click();check(select.value==='jp'&&changes===1,'original select event preserved');
 check(!document.querySelector('[role=listbox]'),'picker removed');
 await wait(()=>select.style.backgroundImage.includes('blob:'));
 const ctx=document.getElementById('canvas').getContext('2d');await wait(()=>f.draw(ctx,'tw',5,5,80,60));
 check(ctx.getImageData(10,10,1,1).data[3]===255,'canvas drawn');
 const circle=await f.create('tw',{format:'circle'});document.body.append(circle);await wait(()=>circle.complete&&circle.naturalWidth);
 const count=downloads;await f.ensure('tw','1:1');check(downloads===count,'circle shares square download');
 select.innerHTML='<option value="jp">🇯🇵 日本語</option>';f.bindSelect(select);await wait(()=>select.selectedOptions[0].label==='日本語');
 select.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 select.style.display='none';await wait(()=>!document.querySelector('[role=listbox]'));select.style.display='';
 document.getElementById('result').textContent='PASS: preload, stale labels, SVG decoding, fallback, select selection/change, canvas, circle cache';
})().catch(e=>document.getElementById('result').textContent='FAIL: '+e.stack);
</script></html>`;
http.createServer((req, res) => {
  res.setHeader('Content-Type', req.url === '/engine.js' ? 'text/javascript; charset=utf-8' : 'text/html; charset=utf-8');
  res.end(req.url === '/engine.js' ? engine : page);
}).listen(8794, '127.0.0.1', () => console.log('Flags fixture: http://127.0.0.1:8794'));
