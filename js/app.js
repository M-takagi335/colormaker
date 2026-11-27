import {Palette,W,H,DOSE} from './physics.js';
import {hex,pigment} from './color.js';
import {challenge,measure} from './game.js';
import {Renderer} from './render.js';
import {Sound} from './audio.js';
import {load,save} from './storage.js';

const $=id=>document.getElementById(id);
const canvas=$('palette'),palette=new Palette(),renderer=new Renderer(canvas),sound=new Sound();
const loaded=load(palette.data.length);
if(loaded)palette.data.set(loaded.data);
const state=loaded ? {
  target:loaded.target,round:loaded.round,history:loaded.history,settings:loaded.settings,
  result:loaded.result??null, best:loaded.best, stats:loaded.stats
} : {
  target:challenge(),round:1,history:[],settings:{volume:45,muted:false},
  result:null,best:0,stats:{submissions:0,sum:0,near:0,perfect:0}
};
const snapshots=[], gestures=new Map();
let frame=0,pendingSave=0, visualDirty=true;
let galleryCount=36;
const pigmentNames=['赤','青','黄','白','黒'];
const tubeNames=['RED','BLUE','YELLOW','WHITE','BLACK'];
sound.configure(state.settings);
$('volume').value=state.settings.volume;
$('mute').checked=state.settings.muted;
for(let i=0;i<5;i++){
  const button=document.createElement('button');
  button.className='tube';
  button.type='button';
  button.style.setProperty('--paint',hex(pigment(Array.from({length:5},(_,p)=>+(p===i)))));
  if(i===2||i===3)button.style.setProperty('--type','#2e2d25');
  button.innerHTML='<span class="tube-body" aria-hidden="true"><span class="metal"><span class="label">'+tubeNames[i]+'</span></span><span class="nozzle"></span><span class="extrude"></span></span><span>'+pigmentNames[i]+'</span>';
  $('tubes').append(button);
  button.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    button.setPointerCapture(event.pointerId);
    sound.start();
    sound.tone('press');
    remember();
    const point=palette.depositPoint(i);
    palette.add(i,DOSE,point);
    gestures.set(event.pointerId,{button,index:i,point,last:performance.now()+230});
    button.dataset.pouring='';
    sound.tone('paint');
    dirty();
  });
  button.addEventListener('lostpointercapture',end);
  button.addEventListener('contextmenu',event=>event.preventDefault());
  button.addEventListener('click',event=>{
    if(event.detail!==0)return;
    sound.start();sound.tone('press');
    remember();
    palette.add(i,DOSE);
    sound.tone('paint');
    dirty();
  });
}

function remember(){
  snapshots.push(palette.data.slice());
  if(snapshots.length>28)snapshots.shift();
}
function point(event,rect){
  return [
    Math.max(-10,Math.min(W+10,(event.clientX-rect.left)*W/rect.width)),
    Math.max(-10,Math.min(H+10,(event.clientY-rect.top)*H/rect.height))
  ];
}
canvas.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  canvas.setPointerCapture(event.pointerId);
  sound.start();remember();
  gestures.set(event.pointerId,{xy:point(event,canvas.getBoundingClientRect()),time:event.timeStamp});
  refreshActions();
});
canvas.addEventListener('pointermove',event=>{
  const gesture=gestures.get(event.pointerId);
  if(!gesture?.xy)return;
  const rect=canvas.getBoundingClientRect(), samples=event.getCoalescedEvents?.();
  for(const sample of samples?.length?samples:[event]){
    const next=point(sample,rect);
    const speed=Math.hypot(next[0]-gesture.xy[0],next[1]-gesture.xy[1]);
    const elapsed=Math.max(4,sample.timeStamp-gesture.time);
    const velocity=Math.min(1.3,.70+speed/elapsed*.95);
    const moved=palette.stroke(...gesture.xy,...next,velocity);
    gesture.time=sample.timeStamp;
    gesture.xy=next;
    if(moved>0){ sound.move(speed/elapsed*16,moved);dirty(); }
  }
});
canvas.addEventListener('lostpointercapture',end);
canvas.addEventListener('contextmenu',event=>event.preventDefault());
window.addEventListener('pointerup',end);
window.addEventListener('pointercancel',end);
function end(event){
  const gesture=gestures.get(event.pointerId);
  if(!gesture)return;
  if(gesture.button){
    squeeze(gesture,performance.now());
    delete gesture.button.dataset.pouring;
  }
  gestures.delete(event.pointerId);
  if(!gestures.size){sound.stop();persist();}
}
function squeeze(g,time){
  if(time<=g.last)return;
  palette.add(g.index,DOSE*(time-g.last)/130,g.point);
  g.last=time;
  if(time>=(g.nextSound??0)){sound.tone('paint');g.nextSound=time+230;}
  dirty();
}
function dirty(){
  visualDirty=true;
  scheduleFrame();
  clearTimeout(pendingSave);
  pendingSave=setTimeout(persist,280);
}
function scheduleFrame(){
  if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);
}
let lastRead=-Infinity;
function draw(time){
  frame=0;
  for(const g of gestures.values())if(g.button)squeeze(g,time);
  if(visualDirty){
    renderer.draw(palette.data);
    visualDirty=false;
  }
  // The live quality meter can lag the brush slightly to keep input responsive.
  if(time-lastRead>140){
    refresh();
    lastRead=time;
  }else if(!gestures.size){
    refresh();
  }
  if(gestures.size)scheduleFrame();
}
function persist(){
  clearTimeout(pendingSave);
  try{save(state,palette.data);$('save-status').textContent='';}
  catch{$('save-status').textContent='ブラウザに保存できませんでした。';}
}
function refreshActions(){
  $('undo').disabled=!snapshots.length;
}
function refresh(){
  const rated=measure(palette,state.target);
  $('round').textContent='お題 '+state.round;
  $('target').style.setProperty('--color',hex(state.target));
  $('current').style.setProperty('--color',rated?.created??'');
  $('current').classList.toggle('empty',!rated);
  $('empty-note').hidden=!!rated;
  $('uniform').value=rated?.uniform??0;
  $('uniform-label').textContent=rated ? (rated.uniform>=98?'均一に混ざっています':'混色の均一度 '+rated.uniform+'%') : '絵の具を出すと比較できます';
  $('finish').disabled=$('reset').disabled=!rated;
  refreshActions();
}
function stopGestures(){
  for(const id of gestures.keys())end({pointerId:id});
}
function clear(next){
  stopGestures();
  palette.data.fill(0);snapshots.length=0;state.result=null;
  if(next){state.target=challenge(Math.random,state.target);state.round++;}
  dirty();refresh();persist();
}
$('undo').onclick=()=>{
  stopGestures();
  const snapshot=snapshots.pop();
  if(snapshot){palette.data.set(snapshot);dirty();refresh();persist();}
};
$('reset').onclick=()=>clear(false);
$('skip').onclick=()=>clear(true);
const swatch=(rgb,title)=>'<div><div class="swatch" style="--color:'+hex(rgb)+'"></div><div>'+title+'</div><code>'+hex(rgb)+'</code></div>';
function showResult(){
  const r=state.result;
  const comments=['もう一度挑戦してみよう！','あと少し！','かなり近い！','ほとんど同じ色！',r.total===100?'完璧！':'ほとんど同じ色！'];
  $('result-body').innerHTML='<div class="swatches">'+swatch(r.target,'見本の色')+swatch(r.rgb,'作った色')+'</div>'+
    '<div class="score">'+r.total+'<small> 点</small></div><div class="stars" aria-label="星 '+r.stars+' 個">'+
    '★'.repeat(r.stars)+'☆'.repeat(5-r.stars)+'</div><p class="hint">'+comments[r.stars-1]+(r.newBest?'　自己ベスト更新！':'　自己ベスト '+state.best+'点')+'</p>'+
    '<div class="details"><span>色の一致度</span><strong>'+r.match+' 点</strong></div><div class="details"><span>混色の均一度</span><strong>'+r.uniform+' 点</strong></div>'+
    (r.hint?'<p class="hint">'+r.hint+'</p>':'');
  $('result').showModal();
}
$('finish').onclick=()=>{
  stopGestures();
  const r=measure(palette,state.target);
  if(!r)return;
  sound.start();sound.tone(r.total>=95?'high':'finish');
  r.newBest=r.total>state.best||!state.stats.submissions;
  state.best=Math.max(state.best,r.total);
  state.stats.submissions++;
  state.stats.sum+=r.total;
  state.stats.near+=+(r.total>=95);
  state.stats.perfect+=+(r.total===100);
  state.history.unshift({rgb:r.rgb,total:r.total});
  state.result=r;persist();showResult();
};
$('result').addEventListener('close',()=>{ state.result=null;persist(); });
$('continue').onclick=()=>$('result').close();
$('retry').onclick=()=>{$('result').close();clear(false);};
$('next').onclick=()=>{$('result').close();clear(true);};
function showRecords(){
  const {submissions, sum, near, perfect}=state.stats;
  const stats=[['最高スコア',submissions?state.best+' 点':'—'],['平均スコア',submissions?(sum/submissions).toFixed(1)+' 点':'—'],
    ['挑戦した問題数',state.round],['採点回数',submissions],['95点以上',near],['100点',perfect]];
  $('records-body').innerHTML=stats.map(([name,value])=>'<div class="stat"><span>'+name+'</span><strong>'+value+'</strong></div>').join('')+
    (submissions?'<div class="gallery">'+state.history.slice(0,galleryCount).map(r=>'<figure><div class="swatch" style="--color:'+hex(r.rgb)+'"></div><figcaption>'+hex(r.rgb)+' · '+r.total+'点</figcaption></figure>').join('')+'</div>':'<p class="hint">採点すると、ここに作った色が並びます。</p>');
  if(state.history.length>galleryCount){
    const more=document.createElement('button');
    more.className='more-records';
    more.textContent='さらに表示';
    more.onclick=()=>{galleryCount+=36;showRecords();};
    $('records-body').append(more);
  }
}
$('records').onclick=()=>{
  stopGestures();galleryCount=36;
  showRecords();$('records-dialog').showModal();
};
$('settings').onclick=()=>{stopGestures();$('settings-dialog').showModal();};
function settings(){
  state.settings={volume:Number($('volume').value),muted:$('mute').checked};
  sound.configure(state.settings);persist();
}
$('volume').oninput=settings;
$('mute').onchange=settings;
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){
    if(frame)cancelAnimationFrame(frame);
    frame=0;stopGestures();sound.stop(true);persist();
  }else scheduleFrame();
});
window.addEventListener('pagehide',()=>{stopGestures();sound.stop(true);persist();});
window.addEventListener('blur',()=>{stopGestures();sound.stop();});
if(!loaded)persist();
refresh();scheduleFrame();
if(state.result)showResult();
