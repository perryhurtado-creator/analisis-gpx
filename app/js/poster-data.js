import {fmt,duration} from './metrics.js';
export const POSTER_LEVELS={
  verde:{label:'Verde — Principiante',color:'#35c77f'},
  azul:{label:'Azul — Intermedia Ligera',color:'#57a6ff'},
  roja:{label:'Roja — Avanzada',color:'#ff6565'},
  negra:{label:'Negra — Experta',color:'#a5b0aa'}
};
export function posterData(activity,options={}){
  const points=activity.points||[],hasElevation=points.some(p=>Number.isFinite(p.ele));
  const completeElevation=points.length>0&&points.every(p=>Number.isFinite(p.ele));
  return {name:String(options.name||activity.name||'Ruta MTB').trim(),level:POSTER_LEVELS[options.level]||null,
    distance:Number.isFinite(activity.distance)?`${fmt(activity.distance/1000)} km`:'Sin datos',
    ascent:hasElevation&&Number.isFinite(activity.ascent)?`${fmt(activity.ascent,0)} m+`:'Sin datos',
    elevationLabel:hasElevation&&!completeElevation?'DESNIVEL + · PARCIAL':'DESNIVEL +',
    time:Number.isFinite(activity.duration)&&activity.duration>0?duration(activity.duration):'Sin datos',
    distancePts:Number.isFinite(activity.distance)?[15,25,40,60,80].filter(n=>activity.distance/1000>n).length+1:null,
    elevationPts:hasElevation&&Number.isFinite(activity.ascent)?[200,500,900,1400,2000].filter(n=>activity.ascent>n).length+1:null};
}
export function posterRuns(points){
  const runs=[];let previous;
  points.forEach((p,index)=>{if(!previous||p.breakBefore||p.segmentId!==previous.segmentId)runs.push([]);runs.at(-1).push(index);previous=p});return runs;
}
// Proyección Web Mercator usada por OpenStreetMap, independiente del mapa visible.
export function posterMapSnapshot(points,width=972,height=400,padding=45){
  if(!points.length)throw Error('Carga una ruta antes de generar el cartel.');
  if(points.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>85.05112878))throw Error('Esta ruta queda fuera de los límites del mapa OpenStreetMap.');
  const unit=points.map(p=>{const lat=p.lat*Math.PI/180;return {x:(p.lon+180)/360,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2}});
  // Desenvolver longitudes permite encuadrar rutas que cruzan el antimeridiano.
  for(let i=1;i<unit.length;i++){while(unit[i].x-unit[i-1].x>.5)unit[i].x--;while(unit[i].x-unit[i-1].x<-.5)unit[i].x++}
  const extent=unit.reduce((b,p)=>({minX:Math.min(b.minX,p.x),maxX:Math.max(b.maxX,p.x),minY:Math.min(b.minY,p.y),maxY:Math.max(b.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
  let zoom=19;while(zoom>0&&((extent.maxX-extent.minX)*256*2**zoom>width-2*padding||(extent.maxY-extent.minY)*256*2**zoom>height-2*padding))zoom--;
  const scale=256*2**zoom,minX=(extent.minX+extent.maxX)/2*scale-width/2,minY=(extent.minY+extent.maxY)/2*scale-height/2;
  const tiles=[],count=2**zoom;
  for(let y=Math.floor(minY/256);y<=Math.floor((minY+height-1)/256);y++){
    if(y<0||y>=count)continue;
    for(let x=Math.floor(minX/256);x<=Math.floor((minX+width-1)/256);x++)tiles.push({url:`https://tile.openstreetmap.org/${zoom}/${((x%count)+count)%count}/${y}.png`,x:x*256-minX,y:y*256-minY});
  }
  return {width,height,tiles,positions:unit.map(p=>({x:p.x*scale-minX,y:p.y*scale-minY})),runs:posterRuns(points)};
}
