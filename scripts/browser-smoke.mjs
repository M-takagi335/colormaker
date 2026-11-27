import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as wait} from 'node:timers/promises';

const base=process.argv[2]||'.';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const server=createServer(async(req,res)=>{
  const name=req.url.replace(/^\/newgame4\//,'')||'index.html';
  if(!/^(?:index\.html|(?:css|js)\/[a-z-]+\.(?:css|js))$/.test(name)){res.statusCode=404;res.end();return;}
  try {const file=await readFile(join(base,name));res.setHeader('Content-Type',types[extname(name)]||'text/plain');res.end(file);}
  catch {res.statusCode=404;res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const profile=await mkdtemp(join(tmpdir(),'atelier-chrome-'));
const chrome=spawn(process.argv[3]||'C:/Program Files/Google/Chrome/Application/chrome.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'
],{stdio:'ignore'});
let ws;
try{
  let endpoint;
  for(let i=0;i<100;i++){
    try{const [debug]=String(await readFile(join(profile,'DevToolsActivePort'))).split(/\r?\n/);
      const list=await (await fetch('http://127.0.0.1:'+debug+'/json/list')).json();endpoint=list.find(x=>x.type==='page')?.webSocketDebuggerUrl;if(endpoint)break;
    }catch{}
    await wait(70);
  }
  assert.ok(endpoint,'browser debugging endpoint');
  ws=new WebSocket(endpoint);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
  let seq=0;
  const callbacks=new Map(),errors=[];
  ws.onmessage=({data})=>{
    const msg=JSON.parse(data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text);
    if(msg.method==='Runtime.consoleAPICalled'&&msg.params.type==='error')errors.push(JSON.stringify(msg.params.args));
    if(!msg.id)return;
    const {resolve,reject}=callbacks.get(msg.id);callbacks.delete(msg.id);
    msg.error?reject(new Error(msg.error.message)):resolve(msg.result);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++seq;callbacks.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
  });
  const run=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||expression);
    return r.result.value;
  };
  async function ready(){
    for(let i=0;i<40;i++){
      if(await run('document.querySelectorAll(".tube").length===5').catch(()=>false))return;
      await wait(80);
    }
    throw Error('Application startup timed out: '+errors.join(','));
  }
  const shot=async()=>{
    const {data}=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(process.argv[4],Buffer.from(data,'base64'));
  };
  await send('Runtime.enable');await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1250,height:900,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:'+port+'/newgame4/'});
  await ready();
  const state='JSON.parse(localStorage.getItem("atelier-pigment-v1"))';
  const field=k=>run(state+'.'+k);
  const rect=selector=>run('((r)=>({x:r.x,y:r.y,w:r.width,h:r.height}))(document.querySelector('+JSON.stringify(selector)+').getBoundingClientRect())');
  const locate=async selector=>{const r=await rect(selector);return [r.x+r.w/2,r.y+r.h/2];};
  const mouse=(type,[x,y])=>send('Input.dispatchMouseEvent',{type,x,y,button:type==='mouseMoved'?'none':'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
  const click=async selector=>{const p=await locate(selector);await mouse('mousePressed',p);await mouse('mouseReleased',p);};
  const sums=()=>run('(()=>{const bytes=Uint8Array.from(atob('+state+'.paint),x=>x.charCodeAt(0)); const a=new Float32Array(bytes.buffer), t=[0,0,0,0,0];for(let i=0;i<a.length;i++)t[i%5]+=a[i];return t})()');
  assert.equal(await run('document.querySelector("#finish").disabled'),true);
  const initial=await field('target');
  for(let i=1;i<=5;i++)await click('.tube:nth-child('+i+')');
  const taps=await sums(); assert.ok(taps.every(v=>Math.abs(v-48)<.001), 'tap doses: '+taps.join(', '));
  const red=await locate('.tube:nth-child(1)');
  await mouse('mousePressed',red);await wait(680);await mouse('mouseReleased',red);
  const held=(await sums())[0];
  assert.ok(held>210);
  await wait(200);assert.equal((await sums())[0],held);
  const before=await field('paint');
  const r=await rect('#palette');
  const at=(x,y)=>[r.x+r.w*x/144,r.y+r.h*y/88];
  await mouse('mousePressed',at(51,32));
  for(const p of [[85,34],[91,48],[56,50],[81,42],[61,34]])await mouse('mouseMoved',at(...p));
  await mouse('mouseReleased',at(61,34));
  const mixed=await field('paint');assert.notEqual(mixed,before);
  if(process.argv[4])await shot();
  await click('#undo');assert.equal(await field('paint'),before);
  await mouse('mousePressed',at(61,33));await mouse('mouseMoved',at(88,46));await mouse('mouseReleased',at(88,46));
  const saved=await field('paint');
  await send('Page.reload');await ready();
  assert.equal(await field('paint'),saved);assert.deepEqual(await field('target'),initial);
  await click('#finish');
  assert.equal(await run('document.querySelector("#result").open'),true);assert.equal(await field('stats.submissions'),1);
  await click('#continue');await click('#records');
  assert.equal(await run('document.querySelectorAll(".gallery figure").length'),1);
  await click('#records-dialog form button');
  await click('#settings');await click('#mute');
  assert.equal(await field('settings.muted'),true);
  await click('#settings-dialog form button');
  await click('#reset');assert.deepEqual(await field('target'),initial);assert.ok((await sums()).every(v=>v===0));
  await click('#skip');assert.notDeepEqual(await field('target'),initial);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:700,deviceScaleFactor:3,mobile:true});
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await wait(120);
  async function touch(type,p){
    await send('Input.dispatchTouchEvent',{type,touchPoints:p?[{x:p[0],y:p[1],id:1}]:[]});
  }
  for(const i of [1,2]){await touch('touchStart',await locate('.tube:nth-child('+i+')'));await touch('touchEnd');}
  assert.ok((await sums()).slice(0,2).every(v=>Math.abs(v-48)<.001));
  const beforeTouch=await field('paint'),mobile=await rect('#palette');
  const position=(x,y)=>[mobile.x+mobile.w*x/144,mobile.y+mobile.h*y/88];
  await touch('touchStart',position(58,43));await touch('touchMove',position(86,48));await touch('touchEnd');
  assert.notEqual(await field('paint'),beforeTouch);
  assert.equal(await run('scrollY'),0);
  assert.ok(await run('document.querySelector("#finish").getBoundingClientRect().bottom<innerHeight'));
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chromium desktop + 390×700 touch emulation; no runtime or console errors.');
}finally{
  ws?.close();chrome.kill();server.close();
  await rm(profile,{recursive:true,force:true,maxRetries:4,retryDelay:150}).catch(()=>{});
}
