const KEY='atelier-pigment-v1';
export function load(length){
  try{
    const saved=JSON.parse(localStorage.getItem(KEY));
    if(!saved||saved.version!==1||saved.target?.length!==3)return null;
    const bytes=Uint8Array.from(atob(saved.paint),c=>c.charCodeAt(0));
    if(bytes.length!==length*4)return null;
    const data=new Float32Array(bytes.buffer);
    if(data.some(x=>!Number.isFinite(x)||x<0))return null;
    return {...saved,data};
  }catch{return null;}
}
export function save(state,data){
  const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  localStorage.setItem(KEY,JSON.stringify({...state,version:1,paint:btoa(binary)}));
}
