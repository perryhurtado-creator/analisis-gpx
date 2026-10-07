import{isConnected}from'./gpx-parser.js';

export const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export const fmt=(v,n=1)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:n}).format(v);
export function duration(ms){
  if(!Number.isFinite(ms)||ms<=0)return'—';
  let s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  return h?`${h} h ${m} min`:(m?`${m} min`:`${sec} s`);
}
export const stamp=ms=>new Date(ms).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
export function summary(a){
  const ps=a.points,hrs=ps.map(p=>p.hr).filter(Number.isFinite),cads=ps.map(p=>p.cad).filter(Number.isFinite);
  const speeds=ps.map(p=>p.speed).filter(Number.isFinite),km=a.distance/1000;
  const sp=a.duration?km/(a.duration/3600000):avg(speeds);
  return{distance:fmt(km)+' km',time:duration(a.duration),speed:sp?fmt(sp)+' km/h':'—',
    ascent:'+'+fmt(a.ascent)+' m',heart:hrs.length?Math.round(avg(hrs))+' lpm':'—',
    cadence:cads.length?Math.round(avg(cads))+' rpm':'—'};
}
function segmentStarts(points){
  const starts=[];let start=0;
  for(let i=0;i<points.length;i++){
    if(i===0||!isConnected(points[i-1],points[i]))start=i;
    starts[i]=start;
  }
  return starts;
}
function smoothedElevation(points,i,start,end){
  const from=Math.max(start,i-2),to=Math.min(end,i+2);
  const vals=points.slice(from,to+1).map(p=>p.ele).filter(Number.isFinite);
  return vals.length?avg(vals):null;
}
export function slopeStats(points){
  const windowM=30,slopes=[];let positiveGain=0,positiveDistance=0;
  const starts=segmentStarts(points);
  for(let i=0;i<points.length;i++){
    const cur=points[i],start=starts[i];
    if(!Number.isFinite(cur.ele)||i===start)continue;
    let j=i-1;
    while(j>start&&cur.d-points[j].d<windowM)j--;
    const dd=cur.d-points[j].d;
    if(dd<20)continue;
    const e1=smoothedElevation(points,j,start,i),e2=smoothedElevation(points,i,start,i);
    if(Number.isFinite(e1)&&Number.isFinite(e2)){
      const slope=(e2-e1)/dd*100;
      slopes.push(slope);
      if(e2>e1){positiveGain+=e2-e1;positiveDistance+=dd;}
    }
  }
  const avgUp=positiveDistance>0?positiveGain/positiveDistance*100:null;
  return{
    maxUp:slopes.length?slopes.reduce((max,value)=>Math.max(max,value),-Infinity):null,
    maxDown:slopes.length?slopes.reduce((min,value)=>Math.min(min,value),Infinity):null,
    avgUp
  };
}
export function speedStats(points){
  const intervals=[],starts=segmentStarts(points);
  let totalDistance=0,totalTime=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!isConnected(a,b)||!Number.isFinite(a.time)||!Number.isFinite(b.time))continue;
    const dt=b.time-a.time,dd=b.d-a.d;
    if(dt<=0||dd<0)continue;
    totalDistance+=dd;totalTime+=dt;
    if(dt<1000||dt>15000||dd<1)continue;
    const speed=dd/(dt/3600000)/1000;
    if(Number.isFinite(speed)&&speed>=0&&speed<=100)intervals.push({i,speed});
  }
  if(!intervals.length)return{max:null,avg:totalTime>0?totalDistance/1000/(totalTime/3600000):null};
  const rolling=[];
  for(const item of intervals){
    const end=points[item.i].time,start=starts[item.i];
    let j=item.i-1;
    while(j>start&&(!Number.isFinite(points[j].time)||end-points[j].time<3000))j--;
    if(!Number.isFinite(points[j].time))continue;
    const dt=points[item.i].time-points[j].time,dd=points[item.i].d-points[j].d;
    if(dt>=3000&&dd>0)rolling.push(dd/(dt/3600000)/1000);
  }
  const maxValues=rolling.length?rolling:intervals.map(x=>x.speed);
  return{
    max:maxValues.reduce((max,value)=>Math.max(max,value),-Infinity),
    avg:totalTime>0?totalDistance/1000/(totalTime/3600000):avg(intervals.map(x=>x.speed))
  };
}
export function heartZones(points){
  const valid=points.filter(p=>Number.isFinite(p.hr));
  if(!valid.length)return[];
  const max=valid.reduce((value,p)=>Math.max(value,p.hr),-Infinity);
  const bounds=[0,.60,.70,.80,.90,1.01].map(x=>max*x),ms=[0,0,0,0,0];
  for(let i=0;i<points.length-1;i++){
    const p=points[i],n=points[i+1];
    if(!isConnected(p,n)||!Number.isFinite(p.hr)||!Number.isFinite(p.time)||!Number.isFinite(n.time))continue;
    const dt=n.time-p.time;
    if(dt<=0||dt>120000)continue;
    let z=0;
    if(p.hr>=bounds[4])z=4;else if(p.hr>=bounds[3])z=3;else if(p.hr>=bounds[2])z=2;else if(p.hr>=bounds[1])z=1;
    ms[z]+=dt;
  }
  return ms.map((time,i)=>({zone:i+1,min:bounds[i],max:i===4?max:bounds[i+1],time}));
}
function selectedElapsed(points,selected){
  if(!selected.length)return null;
  let total=0,first=null,last=null,previous=null;
  const flush=()=>{
    if(Number.isFinite(first)&&Number.isFinite(last)&&last>first)total+=last-first;
    first=null;last=null;
  };
  for(const item of selected){
    const point=item.point;
    if(!previous||item.index!==previous.index+1||!isConnected(previous.point,point)){
      flush();first=Number.isFinite(point.time)?point.time:null;last=first;
    }else if(Number.isFinite(point.time)){
      if(!Number.isFinite(first))first=point.time;
      last=point.time;
    }
    previous=item;
  }
  flush();
  return total>0?total:null;
}
export function segments(activity){
  const points=activity.points,rows=[];
  for(let i=0;i<5;i++){
    const min=activity.distance*i/5,max=activity.distance*(i+1)/5;
    const selected=points.map((point,index)=>({point,index}))
      .filter(({point})=>point.d>=min&&(i===4?point.d<=max:point.d<max));
    if(selected.length<2)continue;
    const seg=selected.map(item=>item.point),first=seg[0],last=seg.at(-1);
    const hrs=seg.map(p=>p.hr).filter(Number.isFinite),cads=seg.map(p=>p.cad).filter(Number.isFinite);
    const elapsed=selectedElapsed(points,selected);
    const sp=elapsed?(last.d-first.d)/1000/(elapsed/3600000):avg(seg.map(p=>p.speed).filter(Number.isFinite));
    rows.push({index:i+1,distance:(last.d-first.d)/1000,time:elapsed,speed:sp,
      up:Math.max(0,last.up-first.up),hr:hrs.length?avg(hrs):null,cad:cads.length?avg(cads):null});
  }
  return rows;
}
