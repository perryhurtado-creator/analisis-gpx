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
