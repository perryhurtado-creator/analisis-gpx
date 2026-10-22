import {accumulateElevation} from './elevation.js';
import {validateActivityXML,validatePointCount} from './activity-limits.js';
const all=(root,name)=>{const n=Array.from(root.getElementsByTagNameNS('*',name));return n.length?n:Array.from(root.getElementsByTagName(name))};
const childText=(node,name)=>{const n=all(node,name)[0];return n?n.textContent.trim():''};

export function optionalNumber(raw){
  if(raw==null||String(raw).trim()==='')return null;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function meters(a,b){
  const r=Math.PI/180,R=6371000,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;
  const x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

export function appendRuns(groups,parsePoint){
  const points=[];
  let nextSegmentId=0;
  for(const group of groups){
    let segmentId=null;
    for(const node of group){
      const point=parsePoint(node);
      if(!point){
        segmentId=null;
        continue;
      }
      if(segmentId===null){
        segmentId=nextSegmentId++;
        point.breakBefore=true;
      }else point.breakBefore=false;
      point.segmentId=segmentId;
      points.push(point);
    }
  }
  return points;
}

function parsePoint(node){
  const lat=optionalNumber(node.getAttribute('lat'));
  const lon=optionalNumber(node.getAttribute('lon'));
  if(lat===null||lon===null||lat < -90||lat > 90||lon < -180||lon > 180)return null;
  const ele=optionalNumber(childText(node,'ele'));
  const timeRaw=childText(node,'time');
  const parsedTime=timeRaw?Date.parse(timeRaw):NaN;
  const hr=optionalNumber(childText(node,'hr'));
  const cad=optionalNumber(childText(node,'cad'));
  const speed=optionalNumber(childText(node,'speed'));
  return {lat,lon,ele,time:Number.isFinite(parsedTime)?parsedTime:null,
    hr:hr!==null&&hr>0?hr:null,cad:cad!==null&&cad>0?cad:null,
    speedSource:speed!==null&&speed>=0?'sensor':null,
    speed:speed!==null&&speed>=0?speed*3.6:null,d:0,up:0};
}

export function parseGPX(xmlText,file){
  validateActivityXML(xmlText);
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror'))throw Error('El archivo no contiene XML válido.');
  if(xml.documentElement&&xml.documentElement.localName!=='gpx')throw Error('El contenido no corresponde al formato seleccionado.');
  const tracks=all(xml,'trkpt'),routes=all(xml,'rtept');
  validatePointCount(tracks.length+routes.length);
  // Preferir el track cuando el planificador incluye ambas representaciones.
  const tag=tracks.length?'trkpt':'rtept',groupTag=tracks.length?'trkseg':'rte';
  const groups=all(xml,groupTag).map(seg=>all(seg,tag)).filter(points=>points.length);
  if(!groups.length)groups.push(tracks.length?tracks:routes);
  const raw=groups.flat();
  if(raw.length<2)throw Error('El GPX necesita al menos dos puntos de track (trkpt) o de ruta (rtept).');
  return finalize(xml,appendRuns(groups,parsePoint),'GPX',file);
}

export function finalize(xml,p,type,file){
  if(p.length<2) throw Error('Los puntos no contienen coordenadas válidas.');
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    cur.d=prev.d;
    cur.up=prev.up;
    if(cur.breakBefore||cur.segmentId!==prev.segmentId)continue;
    const dd=meters(prev,cur);
    cur.d=prev.d+dd;
    const dt=Number.isFinite(cur.time)&&Number.isFinite(prev.time)?(cur.time-prev.time)/1000:null;
    // Una distancia inferior a 1 m sigue siendo válida: incluye marcha lenta y paradas.
    if(dt!==null&&dt>0&&dt<=30&&!Number.isFinite(cur.speed)){cur.speed=dd/dt*3.6;cur.speedSource='gps'}
  }
  const elevation=accumulateElevation(p);
  const times=p.filter(x=>Number.isFinite(x.time)).map(x=>x.time);
  return {points:p,name:childText(xml,'name')||file.replace(/\.(gpx|tcx)$/i,''),type,file,
    distance:p.at(-1).d,...elevation,duration:times.length>1?Math.max(...times)-Math.min(...times):null,
    start:times.length?Math.min(...times):null};
}
export {all,childText};

