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
const headingsCache=new WeakMap();
function cinematicHeadings(points){
  if(headingsCache.has(points))return headingsCache.get(points);
  const count=1024,headings=[];
  for(let i=0;i<=count;i++){
    const p=i/count,a=sampleDistancePoint(points,Math.max(0,p-.025)).point,b=sampleDistancePoint(points,Math.min(1,p+.035)).point;
    let angle=a.segmentId===b.segmentId?Math.atan2((b.lon-a.lon)*Math.cos(a.lat*Math.PI/180),b.lat-a.lat)*180/Math.PI:(headings.at(-1)||0);
    if(i){while(angle-headings[i-1]>180)angle-=360;while(angle-headings[i-1]<-180)angle+=360}
    headings.push(angle);
  }
  // Filtro en ambos sentidos para anticipar curvas sin depender de la tasa de render.
  const alpha=1-Math.exp(-26.4/count/1.2);
  for(let i=1;i<=count;i++)headings[i]=headings[i-1]+alpha*(headings[i]-headings[i-1]);
  for(let i=count-1;i>=0;i--)headings[i]=headings[i+1]+alpha*(headings[i]-headings[i+1]);
  const maxTurn=24*26.4/count;
  for(let i=1;i<=count;i++)headings[i]=headings[i-1]+Math.max(-maxTurn,Math.min(maxTurn,headings[i]-headings[i-1]));
  headingsCache.set(points,headings);return headings;
}
export function cinematicCameraPose(points,progress,samples,bounds=cinematicBounds(points)){
  progress=Math.max(0,Math.min(.95,progress));
  const flightProgress=Math.max(0,Math.min(1,(progress-.14)/.66));
  const sample=sampleDistancePoint(points,flightProgress),trackProgress=(sample.index+sample.mix)/Math.max(1,points.length-1);
  const pose=cameraPose(points,trackProgress,samples),headings=cinematicHeadings(points),position=flightProgress*1024,i=Math.floor(position);
  const heading=headings[i]+(headings[Math.min(i+1,1024)]-headings[i])*(position-i);
  const followRange=Math.max(800,Math.min(6500,bounds.span*.2));
  Object.assign(pose,{heading,pitch:-37,range:followRange,flightProgress,trackProgress});
  if(progress<.14||progress>.80){
    const f=progress<.14?progress/.14:(.95-progress)/.15,ease=f*f*f*(f*(f*6-15)+10);
    pose.lon=bounds.lon*(1-ease)+pose.lon*ease;pose.lat=bounds.lat*(1-ease)+pose.lat*ease;
    const maxHeight=Math.max(...samples.map(p=>p.height))+20;
    pose.height=maxHeight*(1-ease)+pose.height*ease;pose.pitch=-60*(1-ease)-37*ease;
    pose.range=Math.max(1200,bounds.span*1.1)*(1-ease)+followRange*ease;
    pose.heading+=20*(1-ease)*(progress<.14?-1:1);
  }
  return pose;
}
