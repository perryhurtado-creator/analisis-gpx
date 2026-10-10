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
export function cinematicCameraPose(points,progress,samples,bounds=cinematicBounds(points)){
  const flightProgress=Math.max(0,Math.min(1,(progress-.14)/.72));
  const pose=cameraPose(points,flightProgress,samples),sample=sampleVideoPoint(points,flightProgress);
  const tangent=index=>{
    let a=index,b=index;
    while(a>0&&index-a<8&&!points[a].breakBefore&&points[a-1].segmentId===points[a].segmentId)a--;
    while(b<points.length-1&&b-index<8&&!points[b+1].breakBefore&&points[b+1].segmentId===points[b].segmentId)b++;
    const dx=(points[b].lon-points[a].lon)*Math.cos(pose.lat*Math.PI/180),dy=points[b].lat-points[a].lat,length=Math.hypot(dx,dy)||1;
    return [dx/length,dy/length];
  };
  const a=tangent(sample.index),b=tangent(sample.next),dx=a[0]+(b[0]-a[0])*sample.mix,dy=a[1]+(b[1]-a[1])*sample.mix;
  const heading=dx||dy?Math.atan2(dx,dy)*180/Math.PI:0;
  const followRange=Math.max(800,Math.min(6500,bounds.span*.2));
  Object.assign(pose,{heading:heading+18*Math.sin(flightProgress*Math.PI*3),pitch:-37,range:followRange,flightProgress});
  if(progress<.14||progress>.86){
    const f=progress<.14?Math.max(0,progress/.14):Math.min(1,(1-progress)/.14),ease=f*f*(3-2*f);
    pose.lon=bounds.lon*(1-ease)+pose.lon*ease;pose.lat=bounds.lat*(1-ease)+pose.lat*ease;
    const maxHeight=Math.max(...samples.map(p=>p.height))+20;
    pose.height=maxHeight*(1-ease)+pose.height*ease;pose.pitch=-60*(1-ease)-37*ease;
    pose.range=Math.max(1200,bounds.span*1.1)*(1-ease)+followRange*ease;
    pose.heading+=30*(1-ease)*(progress<.14?-1:1);
  }
  return pose;
}
