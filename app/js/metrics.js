export const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export const fmt=(v,n=1)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:n}).format(v);
export function duration(ms){
  if(!Number.isFinite(ms)||ms<=0)return '—';
  let s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return h?`${h} h ${m} min`:(m?`${m} min`:`${sec} s`);
}
export const stamp=ms=>new Date(ms).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
export function summary(a){
  const ps=a.points,hrs=ps.map(p=>p.hr).filter(Number.isFinite),cads=ps.map(p=>p.cad).filter(Number.isFinite);
  const speeds=ps.map(p=>p.speed).filter(Number.isFinite),km=a.distance/1000;
  const sp=a.duration?km/(a.duration/3600000):avg(speeds);
  return {distance:fmt(km)+' km',time:duration(a.duration),speed:sp?fmt(sp)+' km/h':'—',
    ascent:'+'+fmt(a.ascent)+' m',heart:hrs.length?Math.round(avg(hrs))+' lpm':'—',
    cadence:cads.length?Math.round(avg(cads))+' rpm':'—'};
}
export function segments(activity){
  const points=activity.points,rows=[];
  for(let i=0;i<5;i++){
    const min=activity.distance*i/5,max=activity.distance*(i+1)/5;
    const seg=points.filter(p=>p.d>=min&&(i===4?p.d<=max:p.d<max));
    if(seg.length<2)continue;
    const first=seg[0],last=seg.at(-1),hrs=seg.map(p=>p.hr).filter(Number.isFinite),cads=seg.map(p=>p.cad).filter(Number.isFinite);
    const elapsed=first.time&&last.time?last.time-first.time:null;
    const sp=elapsed?(last.d-first.d)/1000/(elapsed/3600000):avg(seg.map(p=>p.speed).filter(Number.isFinite));
    rows.push({index:i+1,distance:(last.d-first.d)/1000,time:elapsed,speed:sp,up:Math.max(0,last.up-first.up),
      hr:hrs.length?avg(hrs):null,cad:cads.length?avg(cads):null});
  }
  return rows;
}
