// Effective red, green, blue and amber reflectance bands under D65.
const spectra = [
  [[.72,.022,.16,.34],.85], [[.12,.50,.76,.037],.92],
  [[.96,.67,.006,.91],.75], [[.94,.93,.91,.93],6.5], [[.022,.015,.016,.018],.40]
];
const absorption = spectra.map(([r,s]) => r.map(v => s*(1-v)**2/(2*v)));
const gamma = v => v <= .0031308 ? 12.92*v : 1.055*v**(1/2.4)-.055;
const linear = v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4;
export function pigment(m, offset=0) {
  let s=0, r=0, g=0, b=0, amber=0;
  for(let p=0;p<5;p++){
    const v=m[offset+p], k=absorption[p];
    s+=v*spectra[p][1]; r+=v*k[0]; g+=v*k[1]; b+=v*k[2]; amber+=v*k[3];
  }
  if(!s)return [255,255,255];
  const reflectance=k => {
    const x=k/s;
    return 1/(1+x+Math.sqrt(x*x+2*x));
  };
  return [reflectance(r),.7*reflectance(g)+.3*reflectance(amber),reflectance(b)].map(v=>Math.round(255*gamma(v)));
}
export const hex = rgb => '#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
export function lab(rgb){
  const [r,g,b]=rgb.map(v=>linear(v/255));
  const f=t=>t>216/24389 ? Math.cbrt(t) : (24389/27*t+16)/116;
  const x=f((.4124564*r+.3575761*g+.1804375*b)/.95047);
  const y=f(.2126729*r+.7151522*g+.072175*b);
  const z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
  return [116*y-16,500*(x-y),200*(y-z)];
}
const rad=d=>d*Math.PI/180;
const cos=d=>Math.cos(rad(d));
export function deltaE([l1,a1,b1],[l2,a2,b2]){
  const c=(Math.hypot(a1,b1)+Math.hypot(a2,b2))/2;
  const gain=1.5-.5*Math.sqrt(c**7/(c**7+25**7));
  a1*=gain; a2*=gain;
  const c1=Math.hypot(a1,b1),c2=Math.hypot(a2,b2);
  const hue=(a,b)=>(Math.atan2(b,a)*180/Math.PI+360)%360;
  const h1=hue(a1,b1),h2=hue(a2,b2);
  let dh=h2-h1, h=(h1+h2)/2;
  if(!c1||!c2){ dh=0; h=h1+h2; }
  else if(Math.abs(dh)>180){ dh+=dh>0?-360:360; h=(h+180)%360; }
  const L=(l1+l2)/2,C=(c1+c2)/2;
  const T=1-.17*cos(h-30)+.24*cos(2*h)+.32*cos(3*h+6)-.20*cos(4*h-63);
  const x=(l2-l1)/(1+.015*(L-50)**2/Math.sqrt(20+(L-50)**2));
  const y=(c2-c1)/(1+.045*C);
  const z=2*Math.sqrt(c1*c2)*Math.sin(rad(dh/2))/(1+.015*C*T);
  const rt=-2*Math.sqrt(C**7/(C**7+25**7))*Math.sin(rad(60*Math.exp(-((h-275)**2)/625)));
  return Math.sqrt(Math.max(0,x*x+y*y+z*z+rt*y*z));
}
