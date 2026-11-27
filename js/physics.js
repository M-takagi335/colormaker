export const W=144,H=88,CELLS=W*H;
export const DOSE=48;
const R=11;
export const thickness=(data,i)=>data[i]+data[i+1]+data[i+2]+data[i+3]+data[i+4];
export class Palette {
  data=new Float32Array(CELLS*5);
  scratch=new Float32Array((2*R+1)**2*5);
  points=[[63,45],[81,45],[72,32],[54,32],[90,32]];
  totals(){
    const sums=[0,0,0,0,0];
    for(let i=0;i<this.data.length;i+=5){
      for(let p=0;p<5;p++) sums[p]+=this.data[i+p];
    }
    return sums;
  }
  depositPoint(p){
    const [x,y]=this.points[p];
    const candidates=[[x,y],[x,y+19],[x,y-17],[x-15,y],[x+15,y]];
    const contamination=([cx,cy])=>{
      let mass=0;
      for(let j=-5;j<=5;j++)for(let i=-5;i<=5;i++){
        if(i*i+j*j>=36)continue;
        const index=((cy+j)*W+cx+i)*5;
        mass+=thickness(this.data,index)-this.data[index+p];
      }
      return mass;
    };
    return candidates.reduce((best,next)=>contamination(next)<contamination(best)?next:best);
  }
  add(p,amount,[x,y]=this.depositPoint(p)){
    // Share a small dispensing area while keeping contact seams between colors.
    const radius=6;
    let sum=0;
    for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++)sum+=Math.max(0,1-(i*i+j*j)/36)**1.4;
    for(let j=-radius;j<=radius;j++)for(let i=-radius;i<=radius;i++){
      const gain=Math.max(0,1-(i*i+j*j)/36)**1.4;
      if(!gain)continue;
      const index=((y+j)*W+x+i)*5;
      if(thickness(this.data,index)>this.data[index+p]){
        // A squeeze displaces underlying paint just beyond its contact patch.
        // Intermixing the new dabs with this ridge requires a brush stroke.
        const angle=i||j?Math.atan2(j,i):0;
        const rx=Math.round(7*Math.cos(angle)),ry=Math.round(7*Math.sin(angle));
        const outer=((y+ry)*W+x+rx)*5;
        for(let c=0;c<5;c++){
          if(c===p)continue;
          this.data[outer+c]+=this.data[index+c];
          this.data[index+c]=0;
        }
      }
      this.data[index+p]+=amount*gain/sum;
    }
  }
  stroke(x,y,toX,toY,speed=1){
    const dx=toX-x,dy=toY-y,distance=Math.hypot(dx,dy);
    if(distance<.08)return 0;
    const steps=Math.ceil(distance/1.45);
    let moved=0;
    for(let i=1;i<=steps;i++){
      moved+=this.drag(x+dx*i/steps,y+dy*i/steps,dx/steps,dy/steps,speed);
    }
    return moved/steps;
  }
  drag(x,y,dx,dy,velocity=1){
    const x0=Math.max(0,Math.ceil(x-R)),x1=Math.min(W-1,Math.floor(x+R));
    const y0=Math.max(0,Math.ceil(y-R)),y1=Math.min(H-1,Math.floor(y+R));
    if(x0>x1||y0>y1)return 0;
    const width=x1-x0+1, scratch=this.scratch, data=this.data;
    // Snapshot the brush footprint, then scatter its fractions into the grid.
    // Deposits received during this step do not move until the next step.
    for(let j=y0;j<=y1;j++){
      scratch.set(data.subarray((j*W+x0)*5,(j*W+x1+1)*5),(j-y0)*width*5);
    }
    const speed=Math.hypot(dx,dy);
    let moved=0;
    for(let j=y0;j<=y1;j++)for(let i=x0;i<=x1;i++){
      const fall=1-((i-x)**2+(j-y)**2)/(R*R);
      if(fall<=0)continue;
      const index=(j*W+i)*5, source=((j-y0)*width+i-x0)*5;
      const mass=thickness(scratch,source);
      if(mass<=0)continue;
      moved+=mass*fall;
      const spread=.025*speed*fall;
      const destX=Math.max(0,Math.min(W-1,i+dx*fall*velocity*.95));
      const destY=Math.max(0,Math.min(H-1,j+dy*fall*velocity*.95));
      const left=Math.floor(destX),top=Math.floor(destY),u=destX-left,v=destY-top;
      const right=Math.min(W-1,left+1),bottom=Math.min(H-1,top+1);
      const a=(top*W+left)*5,b=(top*W+right)*5,c=(bottom*W+left)*5,d=(bottom*W+right)*5;
      const n=Math.max(0,j-1)*W*5+i*5,s=Math.min(H-1,j+1)*W*5+i*5;
      const w=(j*W+Math.max(0,i-1))*5,e=(j*W+Math.min(W-1,i+1))*5;
      for(let p=0;p<5;p++){
        const amount=scratch[source+p],carry=amount*.84,smear=amount*spread;
        data[index+p]-=carry+4*smear;
        data[a+p]+=carry*(1-u)*(1-v); data[b+p]+=carry*u*(1-v);
        data[c+p]+=carry*(1-u)*v; data[d+p]+=carry*u*v;
        data[n+p]+=smear; data[s+p]+=smear; data[w+p]+=smear; data[e+p]+=smear;
      }
    }
    // Kneading exchanges equal quantities of wet paint across cell faces.
    // The exchange does not flatten the height field or touch dry neighbors.
    for(let j=y0;j<y1;j++)for(let i=x0;i<x1;i++){
      const fall=1-((i+.5-x)**2+(j+.5-y)**2)/(R*R);
      if(fall<=0)continue;
      const index=(j*W+i)*5;
      this.knead(index,index+5,.18*speed*fall);
      this.knead(index,index+W*5,.18*speed*fall);
    }
    return moved;
  }
  knead(a,b,fraction){
    const data=this.data, ma=thickness(data,a),mb=thickness(data,b);
    if(ma<.0001||mb<.0001)return;
    const exchange=Math.min(ma,mb)*fraction;
    for(let p=0;p<5;p++){
      const transfer=(data[b+p]/mb-data[a+p]/ma)*exchange;
      data[a+p]+=transfer;
      data[b+p]-=transfer;
    }
  }
}
