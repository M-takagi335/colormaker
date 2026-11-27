export class Sound {
  configure({volume,muted}){
    this.volume=muted?0:volume/100;
    if(this.master)this.master.gain.setTargetAtTime(this.volume*.55,this.context.currentTime,.04);
  }
  start(){
    if(!this.volume)return;
    const Audio=window.AudioContext||window.webkitAudioContext;
    if(!Audio)return;
    if(!this.context){
      const ac=this.context=new Audio();
      const master=this.master=ac.createGain();
      master.gain.value=this.volume*.55;
      master.connect(ac.destination);
      const buffer=ac.createBuffer(1,ac.sampleRate,ac.sampleRate), data=buffer.getChannelData(0);
      let sample=0,seed=713;
      for(let i=0;i<data.length;i++){
        seed=(1664525*seed+1013904223)>>>0;
        sample=.74*sample+(seed/2147483648-1)*.26;
        data[i]=sample;
      }
      const noise=ac.createBufferSource(), filter=this.filter=ac.createBiquadFilter();
      filter.type='lowpass';filter.frequency.value=610;
      const gain=this.texture=ac.createGain();
      gain.gain.value=0;
      noise.buffer=buffer;noise.loop=true;
      noise.connect(filter).connect(gain).connect(master);noise.start();
    }
    if(this.context.state==='suspended')this.context.resume().catch(()=>{});
  }
  move(speed,mass){
    if(!this.texture)return;
    const now=this.context.currentTime;
    this.filter.frequency.setTargetAtTime(390+Math.min(1750,speed*37),now,.04);
    this.texture.gain.setTargetAtTime(Math.min(.27,mass*.006+speed*.003),now,.03);
    this.texture.gain.setTargetAtTime(0,now+.055,.065);
  }
  tone(kind){
    if(!this.context||!this.volume)return;
    const notes={press:[148],paint:[252],finish:[392,523],high:[392,523,659]};
    const ac=this.context;
    notes[kind].forEach((f,i)=>{
      const t=ac.currentTime+i*.09, osc=ac.createOscillator(), gain=ac.createGain();
      osc.frequency.setValueAtTime(f,t);
      osc.frequency.exponentialRampToValueAtTime(f*(i||kind==='high'?1.01:.72),t+.13);
      gain.gain.setValueAtTime(.001,t);
      gain.gain.exponentialRampToValueAtTime(.14,t+.022);
      gain.gain.exponentialRampToValueAtTime(.001,t+.18);
      osc.connect(gain).connect(this.master);osc.start(t);osc.stop(t+.19);
    });
  }
  stop(hidden=false){
    if(!this.texture)return;
    const now=this.context.currentTime;
    this.texture.gain.cancelScheduledValues(now);
    this.texture.gain.setTargetAtTime(0,now,.03);
    if(hidden)this.context.suspend().catch(()=>{});
  }
}
