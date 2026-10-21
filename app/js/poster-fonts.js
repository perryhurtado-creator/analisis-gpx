export const TITLE_FONTS={
  anton:{label:'Anton · Potente',family:'Anton',weight:400,file:'anton.woff'},
  bebas:{label:'Bebas Neue · Estrecha',family:'Bebas Neue',weight:400,file:'bebasneue.woff'},
  bangers:{label:'Bangers · Cómic extremo',family:'Bangers',weight:400,file:'bangers.woff'},
  marker:{label:'Permanent Marker · Pincel',family:'Permanent Marker',weight:400,file:'permanentmarker.woff'},
  blackops:{label:'Black Ops One · Militar',family:'Black Ops One',weight:400,file:'blackopsone.woff'},
  classic:{label:'Arial · Clásica',family:'Arial',weight:900,local:true}
};
const promises=new Map();
export async function ensureTitleFont(key){
  const font=TITLE_FONTS[key]||TITLE_FONTS.blackops;
  if(font.local)return true;
  if(promises.has(font.family))return promises.get(font.family);
  const promise=(async()=>{
    const url=new URL('../assets/fonts/'+font.file,import.meta.url).href;
    const face=new FontFace(font.family,`url("${url}") format("woff")`,{weight:String(font.weight),style:'normal'});
    await face.load();document.fonts.add(face);
    return document.fonts.check(`${font.weight} 52px "${font.family}"`,'LA MAGNÍFICA QUERÉTARO ÑÜ2026');
  })().catch(()=>false);
  promises.set(font.family,promise);
  const ok=await promise;
  if(!ok)promises.delete(font.family); // Permitir reintentar una descarga interrumpida.
  return ok;
}
