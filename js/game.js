import {pigment,lab,deltaE,hex} from './color.js';
import {thickness} from './physics.js';
export function challenge(random=Math.random, previous){
  let rgb;
  for(let attempt=0;attempt<24;attempt++){
    const pick=n=>Math.floor(random()*n);
    const a=pick(3), b=(a+1+pick(2))%3;
    const amounts=[0,0,0,0,0];
    amounts[a]=5+pick(29);
    amounts[b]=pick(28);
    const style=pick(8);
    if(style>=3&&style<=5)amounts[3]=2+pick(50);
    if(style===6)amounts[4]=2+pick(15);
    if(style===7){ amounts[3]=pick(25); amounts[3-a-b]=2+pick(22); }
    rgb=pigment(amounts);
    if(!previous || deltaE(lab(previous),lab(rgb))>=7)break;
  }
  return rgb;
}
export function measure(palette,target){
  const totals=palette.totals(), mass=totals.reduce((a,b)=>a+b,0);
  if(!mass)return null;
  const rgb=pigment(totals), color=lab(rgb), reference=lab(target);
  let variance=0;
  for(let i=0;i<palette.data.length;i+=5){
    const weight=thickness(palette.data,i);
    if(weight>0)variance+=weight*deltaE(color,lab(pigment(palette.data,i)))**2;
  }
  const spread=Math.sqrt(variance/mass);
  const match=100*Math.exp(-deltaE(color,reference)/21);
  const uniform=100*Math.exp(-spread/10);
  const raw=.8*match+.2*uniform;
  const overall=Math.min(raw,match+8,72+.28*uniform);
  const score=value=>value>=100 ? 100 : Math.min(99.9,Math.round(value*10)/10);
  let hint='';
  if(spread>5)hint='色の筋が残っています。境目をまたいで混ぜてみましょう。';
  else if(color[0]<reference[0]-3)hint='見本より暗めです。明るさを比べてみましょう。';
  else if(color[0]>reference[0]+3)hint='見本より明るめです。明るさを比べてみましょう。';
  else if(color[2]>reference[2]+4)hint='見本より黄色みが強めです。';
  else if(Math.hypot(...color.slice(1))<Math.hypot(...reference.slice(1))-4)hint='見本の方が鮮やかです。';
  const stars=overall>=95?5:overall>=86?4:overall>=72?3:overall>=52?2:1;
  return {rgb, target, match:score(match), uniform:score(uniform), total:score(overall), stars, hint, created:hex(rgb)};
}
