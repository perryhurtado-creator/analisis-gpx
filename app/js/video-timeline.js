// Visual sampling only: never change the activity used for analysis.
export const DEFAULT_VIDEO_SETTINGS=Object.freeze({duration:9,mode:'distance',tailSeconds:2});
export function videoSettings(options={}){
  const duration=Number(options.duration),tail=Number(options.tailSeconds);
  return {duration:Number.isFinite(duration)?Math.round(Math.min(120,Math.max(3,duration))):9,
    mode:options.mode==='time'?'time':'distance',tailSeconds:Number.isFinite(tail)?Math.min(10,Math.max(0,tail)):2};
}
export function continuous(a,b){return !!a&&!!b&&!b.breakBefore&&a.segmentId===b.segmentId}
function lerp(a,b,mix){return Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*mix:null}
export function samplePoint(points,index,nextIndex=index,mix=0,progress=0,inGap=false){
  const a=points[index],b=points[nextIndex];
  if(!a)throw Error('No hay puntos para animar.');
  const point={...a};
  if(mix>0&&continuous(a,b)){
    for(const field of ['lat','ele','speed','hr','cad','d','up','time'])point[field]=lerp(a[field],b[field],mix);
    const delta=((b.lon-a.lon+540)%360)-180;
    point.lon=((a.lon+delta*mix+540)%360)-180;
  }
  return {index,nextIndex,mix,point,progress,inGap};
}
export function createVideoTimeline(points,options={}){
  if(!points?.length)throw Error('Carga una ruta antes de reproducir.');
  const settings=videoSettings(options);
  const validTimes=points.every((p,i)=>Number.isFinite(p.time)&&(i===0||p.time>=points[i-1].time))&&points.at(-1).time>points[0].time;
  const validDistance=points.every((p,i)=>Number.isFinite(p.d)&&(i===0||p.d>=points[i-1].d))&&points.at(-1).d>points[0].d;
  const mode=settings.mode==='time'&&validTimes?'time':validDistance?'distance':'points';
  const keys=points.map((p,i)=>mode==='points'?i:p[mode==='time'?'time':'d']);
  const first=keys[0],span=keys.at(-1)-first;
  function at(value){
    const progress=Math.min(1,Math.max(0,Number(value)||0));
    if(progress===0||points.length===1)return samplePoint(points,0,0,0,progress);
    if(progress===1)return samplePoint(points,points.length-1,points.length-1,0,1);
    const target=first+span*progress;
    // Upper bound: equal-distance points at segment boundaries must not be bridged.
    let lo=0,hi=keys.length;
    while(lo<hi){const mid=(lo+hi)>>1;if(keys[mid]<=target)lo=mid+1;else hi=mid}
    const index=Math.max(0,lo-1),nextIndex=Math.min(points.length-1,index+1);
    const inGap=!continuous(points[index],points[nextIndex]);
    const mix=inGap||keys[nextIndex]===keys[index]?0:(target-keys[index])/(keys[nextIndex]-keys[index]);
    return samplePoint(points,index,nextIndex,mix,progress,inGap&&index!==nextIndex);
  }
  return {...settings,mode,requestedMode:settings.mode,at,
    trailStart:sample=>at(Math.max(0,sample.progress-settings.tailSeconds/settings.duration))};
}
// Both Leaflet and Canvas consume these exact segment runs.
export function videoRouteChunks(points,end,start=null){
  const chunks=[],begin=start?.index??0;
  let run=[start?.point??points[0]];
  for(let i=begin+1;i<=end.index;i++){
    if(!continuous(points[i-1],points[i])){chunks.push(run);run=[]}
    run.push(points[i]);
  }
  if(end.mix>0)run.push(end.point);
  if(run.length)chunks.push(run);
  return chunks;
}
