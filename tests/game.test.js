import test from 'node:test';
import assert from 'node:assert/strict';
import {pigment,lab,deltaE} from '../js/color.js';
import {Palette,DOSE,W,H} from '../js/physics.js';
import {challenge,measure} from '../js/game.js';
import {load,save} from '../js/storage.js';

test('CIEDE2000 reference pairs and D65 white',()=>{
  const pairs=[
    [[50,2.6772,-79.7751],[50,0,-82.7485],2.0425],
    [[50,3.1571,-77.2803],[50,0,-82.7485],2.8615],
    [[50,0,0],[50,-1,2],2.3669],
    [[50,2.49,-.001],[50,-2.49,.0011],7.2195]
  ];
  for(const [a,b,expected] of pairs){
    assert.ok(Math.abs(deltaE(a,b)-expected)<.0001);
    assert.ok(Math.abs(deltaE(b,a)-expected)<.0001);
  }
  assert.ok(deltaE(lab([255,255,255]),[100,0,0])<.0001);
});
test('four-band pigments produce secondary hues and respond to tints and shades',()=>{
  const green=pigment([0,1,1,0,0]), orange=pigment([1,0,1,0,0]), purple=pigment([1,1,0,0,0]);
  assert.ok(green[1]>green[0]&&green[0]>green[2]);
  assert.ok(orange[0]>orange[1]&&orange[1]>orange[2]+45);
  assert.ok(purple[2]>purple[0]&&purple[0]>purple[1]+35);
  const red=pigment([1,0,0,0,0]);
  assert.ok(lab(pigment([1,0,0,1,0]))[0]>lab(red)[0]);
  assert.ok(lab(pigment([1,0,0,0,.1]))[0]<lab(red)[0]);
  assert.notDeepEqual(pigment([1,2,0,0,0]),pigment([2,1,0,0,0]));
});
test('squeezing separates colors, repeated strokes mix locally and preserve each pigment',()=>{
  const p=new Palette();
  p.add(0,DOSE);p.add(1,DOSE);p.add(2,DOSE,[116,69]);
  const remote=p.data.slice((60*W)*5);
  const local = new Palette();
  local.data.set(p.data.subarray(0,60*W*5));
  const target=pigment(local.totals()), initial=measure(local,target);
  assert.equal(initial.match,100);
  assert.ok(initial.uniform<35);
  assert.ok(initial.total<84);
  for(let pass=0;pass<60;pass++){
    p.stroke(53,45,90,45);
    p.stroke(90,45,53,45);
  }
  assert.deepEqual(p.data.slice((60*W)*5),remote);
  local.data.set(p.data.subarray(0,60*W*5));
  assert.ok(measure(local,target).uniform>initial.uniform+10);
  for(const total of p.totals().slice(0,3))assert.ok(Math.abs(total-DOSE)<.0002);
  assert.ok(p.data.every(x=>x>=0));
  assert.deepEqual(pigment(local.totals()),target);
});
test('overlapping fresh paint displaces underlying colors without mass loss',()=>{
  const p=new Palette(), center=[71,42];
  p.add(0,DOSE,center);p.add(1,DOSE,center);
  assert.equal(p.data[(42*W+71)*5],0);
  assert.ok(p.data[(42*W+71)*5+1]>0);
  assert.ok(Math.abs(p.totals()[0]-DOSE)<1e-5);
});
test('edge strokes conserve mass and uniform exact matches earn full score',()=>{
  const p=new Palette();
  assert.equal(measure(p,[0,0,0]),null);
  p.add(4,DOSE,[7,H-8]);
  for(let i=0;i<22;i++){
    p.stroke(9,H-6,-5,H+4);
    p.stroke(0,H-1,0,H-14);
  }
  assert.ok(Math.abs(p.totals()[4]-DOSE)<.0002);
  assert.equal(measure(p,pigment(p.totals())).total,100);
});
test('targets vary and only use whole tube doses',()=>{
  let seed=171;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  const set=new Set();
  for(let i=0;i<150;i++)set.add(challenge(random).join());
  assert.ok(set.size>125);
  assert.deepEqual(challenge(()=>0),pigment([5*DOSE,0,0,0,0]));
});
test('versioned save round-trips exact paint strata and rejects invalid data',()=>{
  let stored=null;
  globalThis.localStorage={getItem:()=>stored,setItem:(_key,val)=>{stored=val;}};
  const p=new Palette(), state={target:[22,32,42],round:17};
  p.add(0,DOSE);p.add(1,DOSE);p.stroke(56,45,84,45);
  save(state,p.data);
  const restored=load(p.data.length);
  assert.deepEqual(restored.data,p.data);
  assert.deepEqual(restored.target,state.target);
  assert.equal(load(1),null);
  stored='{"version":99}';
  assert.equal(load(p.data.length),null);
});
