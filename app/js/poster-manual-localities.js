import {normalizeName} from './locality-selection.js';
import {posterCoordinate} from './poster-data.js';

export function parseManualLocalities(text){
  const names=[...new Map(String(text||'').split(',').map(n=>n.trim()).filter(Boolean).map(n=>[normalizeName(n),n])).values()];
  if(names.length>10)throw Error('Agrega como máximo 10 localidades, separadas por una coma.');
  if(names.some(n=>n.length<3||n.length>120))throw Error('Cada localidad debe tener entre 3 y 120 caracteres.');
  return names;
}
const matches=(query,name)=>{const q=normalizeName(query),n=normalizeName(name);return n===q||n.endsWith(' '+q)||n.startsWith(q+' ')};
const routeGap=(position,positions)=>{let best=Infinity;for(const p of positions)best=Math.min(best,Math.hypot(p.x-position.x,p.y-position.y));return best};

export async function manualPosterLocalities(text,points,snapshot,signal,fetcher=fetch){
  const names=parseManualLocalities(text),places=[],warnings=[];
  if(!names.length)return {places,warnings};
  const bounds=points.reduce((b,p)=>({s:Math.min(b.s,p.lat),n:Math.max(b.n,p.lat),w:Math.min(b.w,p.lon),e:Math.max(b.e,p.lon)}),{s:90,n:-90,w:180,e:-180});
  const lat=((bounds.s+bounds.n)/2).toFixed(2),lon=((((snapshot.projection.centerX*360)%360)+360)%360-180).toFixed(2);
  let cursor=0;
  const results=new Array(names.length);
  async function worker(){while(cursor<names.length){const index=cursor++,name=names[index];
    if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
    try{
      const response=await fetcher('/api/places?'+new URLSearchParams({q:name,lat,lon,localities:'1'}),{signal:AbortSignal.any([signal,AbortSignal.timeout(6500)])});
      if(!response.ok){results[index]={warning:`No se pudo buscar «${name}». Intenta de nuevo.`};continue}
      const data=await response.json();if(!Array.isArray(data.places))throw Error('Respuesta inválida');
      const candidates=data.places.filter(p=>matches(name,p.name||p.label?.split(',')[0])||normalizeName(name).split(' ').every(word=>normalizeName(p.label).includes(word))).map(p=>({...p,position:posterCoordinate(snapshot,p)}))
        .filter(p=>p.position&&p.position.x>=15&&p.position.x<=snapshot.width-15&&p.position.y>=8&&p.position.y<=1452)
        .sort((a,b)=>routeGap(a.position,snapshot.positions)-routeGap(b.position,snapshot.positions));
      if(!candidates.length){results[index]={warning:`Localidad no encontrada en mapa: ${name}.`};continue}
      const best=candidates[0],second=candidates[1];
      if(second&&Math.hypot(best.position.x-second.position.x,best.position.y-second.position.y)>15){results[index]={warning:`Hay varias localidades llamadas «${name}» en el mapa. Añade municipio o estado al nombre.`};continue}
      results[index]={place:{name,lat:best.lat,lon:best.lon,position:best.position,manual:true,priority:index}};
    }catch(error){if(signal.aborted||error.name==='AbortError')throw error;results[index]={warning:`No se pudo buscar «${name}». Intenta de nuevo.`}}
  }}
  await Promise.all([worker(),worker()]);
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  for(const result of results){if(result.place)places.push(result.place);else warnings.push(result.warning)}
  return {places,warnings};
}

const validCoordinate=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=85.05112878&&Math.abs(p.lon)<=180;
export function mergeManualLabels(automatic,manual){
  // Nombre y proximidad juntos: ni un homónimo lejano ni un vecino son duplicados.
  return [...manual,...automatic.filter(a=>!manual.some(m=>normalizeName(a.name)===normalizeName(m.name)&&validCoordinate(a)&&validCoordinate(m)&&Math.hypot((((a.lon-m.lon)+540)%360-180)*111320*Math.cos((a.lat+m.lat)/2*Math.PI/180),(a.lat-m.lat)*111320)<250))];
}
