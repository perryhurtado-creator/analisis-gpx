// Geometría compartida por reproducción y exportación, sin dependencias WebGL.
import {sampleVideoPoint} from './video-capture.js';
export function routeChunks(points){
  const chunks=[];
  points.forEach((p,i)=>{if(!i||p.breakBefore||p.segmentId!==points[i-1].segmentId)chunks.push([]);chunks.at(-1).push(p)});
  return chunks;
}
export function terrainSampleIndices(points,max=96){
  const set=new Set([0,points.length-1]);
  const stride=Math.max(1,Math.ceil((points.length-1)/(max-1)));
  for(let i=0;i<points.length;i+=stride)set.add(i);
  points.forEach((p,i)=>{if(p.breakBefore||(i&&p.segmentId!==points[i-1].segmentId)){set.add(i);if(i)set.add(i-1)}});
  return [...set].sort((a,b)=>a-b);
}
export function cameraPose(points,progress,samples){
  const sample=sampleVideoPoint(points,progress),position=sample.index+sample.mix;
  let low=0,high=samples.length-1;
  while(low<high){const mid=(low+high)>>1;if(samples[mid].index<position)low=mid+1;else high=mid}
  const b=samples[low],a=samples[Math.max(0,low-1)];
  const ratio=a.index===b.index?0:Math.max(0,Math.min(1,(position-a.index)/(b.index-a.index)));
  const height=a.height+(b.height-a.height)*ratio;
  return {lon:sample.point.lon,lat:sample.point.lat,height:height+20,heading:0,pitch:-50,range:Math.max(500,Math.min(2000,(points.at(-1).d||1000)/4))};
}

export function cinematicBounds(points){
  let south=Infinity,north=-Infinity,west=Infinity,east=-Infinity;
  for(const p of points){south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lon);east=Math.max(east,p.lon)}
  const lat=(south+north)/2,lon=(west+east)/2;
  const span=Math.hypot((north-south)*111320,(east-west)*111320*Math.cos(lat*Math.PI/180));
  return {lat,lon,span};
}
// Avance por distancia acumulada; los cortes siguen siendo saltos entre tramos.
export function sampleDistancePoint(points,progress){
  const total=points.at(-1).d||0;if(total<=0)return sampleVideoPoint(points,progress);
  if(progress>=1)return sampleVideoPoint(points,1);
  const distance=Math.max(0,progress)*total;let lo=0,hi=points.length-1;
  while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(points[mid].d<=distance)lo=mid;else hi=mid-1}
  const next=Math.min(lo+1,points.length-1),span=points[next].d-points[lo].d;
  const mix=span>0&&!points[next].breakBefore&&points[lo].segmentId===points[next].segmentId?(distance-points[lo].d)/span:0;
  return sampleVideoPoint(points,(lo+mix)/Math.max(1,points.length-1));
}
export function cinematicCameraPose(points,progress,samples,bounds=cinematicBounds(points)){
  progress=Math.max(0,Math.min(.95,progress));
  const flightProgress=Math.max(0,Math.min(1,(progress-.14)/.66));
  const sample=sampleDistancePoint(points,flightProgress),trackProgress=(sample.index+sample.mix)/Math.max(1,points.length-1);
  // El encuadre depende solo de la extensión de la ruta, nunca del marcador.
  // Margen para conservar el recorrido completo en la vista horizontal inclinada.
  const range=Math.max(1200,bounds.span*1.6);
  let zoom=0;
  if(progress<.14)zoom=1-progress/.14;
  else if(progress>.80)zoom=(progress-.80)/.15;
  const ease=zoom*zoom*zoom*(zoom*(zoom*6-15)+10);
  return {lon:bounds.lon,lat:bounds.lat,height:Math.max(...samples.map(p=>p.height))+20,
    heading:0,pitch:-50,range:range*(1+.12*ease),flightProgress,trackProgress};
}
