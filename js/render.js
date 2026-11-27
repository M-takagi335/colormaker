import {pigment} from './color.js';
import {W,H,CELLS,thickness} from './physics.js';

const SCALE=2, WIDTH=W*SCALE, HEIGHT=H*SCALE;
export class Renderer {
  constructor(canvas){
    canvas.width=WIDTH;
    canvas.height=HEIGHT;
    this.context=canvas.getContext('2d',{alpha:true});
    this.image=this.context.createImageData(WIDTH,HEIGHT);
    this.height=new Float32Array(CELLS);
    this.sample=new Float32Array(5);
  }
  draw(data){
    const h=this.height, pixels=this.image.data;
    let left=W, right=-1, top=H, bottom=-1;
    for(let i=0;i<CELLS;i++){
      const depth=h[i]=Math.log1p(thickness(data,i*5)*1.9);
      if(depth<.004)continue;
      const x=i%W,y=Math.floor(i/W);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
    }
    pixels.fill(0);
    for(let y=Math.max(0,top*SCALE-4);y<Math.min(HEIGHT,(bottom+1)*SCALE+4);y++){
      const v=Math.max(0,y/SCALE-.25),j=Math.floor(v),fy=v-j;
      const row=j*W,nextRow=Math.min(H-1,j+1)*W;
      for(let x=Math.max(0,left*SCALE-4);x<Math.min(WIDTH,(right+1)*SCALE+4);x++){
        const u=Math.max(0,x/SCALE-.25),i=Math.floor(u),fx=u-i,next=Math.min(W-1,i+1);
        const a=row+i,b=row+next,c=nextRow+i,d=nextRow+next;
        const t=((1-fx)*h[a]+fx*h[b])*(1-fy)+((1-fx)*h[c]+fx*h[d])*fy;
        const o=(y*WIDTH+x)*4;
        if(t<.009){
          const shadow=((1-fx)*h[a-W]+fx*h[b-W])||0;
          pixels[o]=62;pixels[o+1]=44;pixels[o+2]=27;
          pixels[o+3]=Math.min(25,shadow*32);
          continue;
        }
        const gx=(h[b]-h[a])*(1-fy)+(h[d]-h[c])*fy;
        const gy=(h[c]-h[a])*(1-fx)+(h[d]-h[b])*fx;
        const nx=-gx,ny=-gy,nz=.58,norm=Math.hypot(nx,ny,nz);
        const light=(nx*-.46+ny*-.52+nz*.72)/norm;
        const gloss=Math.max(0,(nx*-.27+ny*-.39+nz*.88)/norm)**21;
        for(let p=0;p<5;p++){
          this.sample[p]=(data[a*5+p]*(1-fx)+data[b*5+p]*fx)*(1-fy)+
            (data[c*5+p]*(1-fx)+data[d*5+p]*fx)*fy;
        }
        const rgb=pigment(this.sample),shade=.54+.47*Math.max(0,light);
        for(let k=0;k<3;k++)pixels[o+k]=rgb[k]*shade+(255-rgb[k]*shade)*gloss*.68;
        pixels[o+3]=Math.min(255,255*(t-.009)/.038);
      }
    }
    this.context.putImageData(this.image,0,0);
  }
}
