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
function smoothedElevation(points,i){
  const start=Math.max(0,i-2),end=Math.min(points.length-1,i+2);
  const vals=points.slice(start,end+1).map(p=>p.ele).filter(Number.isFinite);
  return vals.length?avg(vals):null;
}
export function slopeStats(points){
  const windowM=30,slopes=[];
  let positiveGain=0,positiveDistance=0;
  for(let i=0;i<points.length;i++){
    const cur=points[i];
    if(!Number.isFinite(cur.ele)||cur.d<windowM)continue;
    let j=i-1;
    while(j>0&&cur.d-points[j].d<windowM)j--;
    const dd=cur.d-points[j].d;
    if(dd<20)continue;
    const e1=smoothedElevation(points,j),e2=smoothedElevation(points,i);
    if(Number.isFinite(e1)&&Number.isFinite(e2)){
      const slope=(e2-e1)/dd*100;
      slopes.push(slope);
      if(e2>e1){positiveGain+=e2-e1;positiveDistance+=dd;}
    }
  }
  const totalDistance=points.at(-1)?.d||0;
  const avgUp=positiveDistance>0?positiveGain/positiveDistance*100:null;
  return {
    maxUp:slopes.length?Math.max(...slopes):null,
    maxDown:slopes.length?Math.min(...slopes):null,
    avgUp:avgUp
  };
}
export function speedStats(points){
  const intervals=[];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!a.time||!b.time)continue;
    const dt=b.time-a.time,dd=b.d-a.d;
    if(dt<1000||dt>15000||dd<1)continue;
    const speed=dd/(dt/3600000)/1000;
    if(Number.isFinite(speed)&&speed>=0&&speed<=100)intervals.push({i,speed});
  }
  if(!intervals.length)return {max:null,avg:null};
  const rolling=[];
  for(const item of intervals){
    const end=points[item.i].time;
    let j=item.i-1;
    while(j>0&&end-points[j].time<3000)j--;
    const dt=points[item.i].time-points[j].time,dd=points[item.i].d-points[j].d;
    if(dt>=3000&&dd>0)rolling.push(dd/(dt/3600000)/1000);
  }
  const totalTime=points.at(-1).time-points[0].time,totalDistance=points.at(-1).d;
  return {
    max:Math.max(...(rolling.length?rolling:intervals.map(x=>x.speed))),
    avg:totalTime>0?totalDistance/1000/(totalTime/3600000):avg(intervals.map(x=>x.speed))
  };
}
export function heartZones(points){
  const valid=points.filter(p=>Number.isFinite(p.hr));
  if(!valid.length)return [];
  const max=Math.max(...valid.map(p=>p.hr));
  const bounds=[0,.60,.70,.80,.90,1.01].map(x=>max*x);
  const ms=[0,0,0,0,0];
  for(let i=0;i<points.length-1;i++){
    const p=points[i],n=points[i+1];
    if(!Number.isFinite(p.hr)||!p.time||!n.time)continue;
    const dt=n.time-p.time;
    if(dt<=0||dt>120000)continue;
    let z=0;
    if(p.hr>=bounds[4])z=4;else if(p.hr>=bounds[3])z=3;else if(p.hr>=bounds[2])z=2;else if(p.hr>=bounds[1])z=1;
    ms[z]+=dt;
  }
  return ms.map((time,i)=>({zone:i+1,min:bounds[i],max:i===4?max:bounds[i+1],time}));
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
