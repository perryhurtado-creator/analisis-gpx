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
  const sp=continuousSpeed(ps)??avg(speeds);
  return {distance:fmt(km)+' km',time:duration(a.duration),speed:sp?fmt(sp)+' km/h':'—',
    ascent:'+'+fmt(a.ascent)+' m',heart:hrs.length?Math.round(avg(hrs))+' lpm':'—',
    cadence:cads.length?Math.round(avg(cads))+' rpm':'—'};
}
function runStarts(points){
  let start=0;
  return points.map((p,i)=>{if(i===0||p.breakBefore||p.segmentId!==points[i-1].segmentId)start=i;return start});
}
function continuousTime(points){
  let ms=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!b.breakBefore&&a.segmentId===b.segmentId&&Number.isFinite(a.time)&&Number.isFinite(b.time)&&b.time>a.time)ms+=b.time-a.time;
  }
  return ms||null;
}
export function continuousSpeed(points){
  let ms=0,d=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(b.breakBefore||a.segmentId!==b.segmentId||!Number.isFinite(a.time)||!Number.isFinite(b.time)||b.time<=a.time)continue;
    ms+=b.time-a.time;d+=b.d-a.d;
  }
  return ms?d/ms*3600:null;
}
function smoothedElevation(points,i,starts){
  const segmentId=points[i]?.segmentId;
  if(segmentId==null)return null;
  const vals=[];
  for(let j=Math.max(starts[i],i-2);j<=Math.min(points.length-1,i+2);j++){
    if(points[j].segmentId!==segmentId)continue;
    if(j>i&&points[j].breakBefore)break;
    if(Number.isFinite(points[j].ele))vals.push(points[j].ele);
  }
  return vals.length?avg(vals):null;
}
// Ventanas de distancia y tiempo: evitan máximos falsos por ruido GPS/altímetro.
// Nunca se calculan valores cruzando trkseg/Track ni puntos sin datos.
function gradeWindow(points,starts,windowM,minM,maxM){
 const slopes=[];
 for(let i=1;i<points.length;i++){
  const cur=points[i],first=starts[i];
  if(i<=first||!Number.isFinite(cur.ele))continue;
  let j=i-1;
  while(j>first&&cur.d-points[j].d<windowM)j--;
  const dd=cur.d-points[j].d;
  if(dd<minM||dd>maxM)continue;
  const e1=smoothedElevation(points,j,starts),e2=smoothedElevation(points,i,starts);
  if(!Number.isFinite(e1)||!Number.isFinite(e2))continue;
  const slope=(e2-e1)/dd*100;
  if(Number.isFinite(slope))slopes.push({slope,dd,e1,e2});
 }
 return slopes;
}
export function slopeStats(points){
 const starts=runStarts(points);
 const short=gradeWindow(points,starts,12,8,35);
 const sustained=gradeWindow(points,starts,60,30,180);
 const maxUp=values=>values.length?values.reduce((m,v)=>Math.max(m,v.slope),0):null;
 const maxDown=values=>values.length?values.reduce((m,v)=>Math.min(m,v.slope),0):null;
 let gain=0,distance=0;
 for(const x of sustained)if(x.slope>0){gain+=x.e2-x.e1;distance+=x.dd}
 return {maxUp:maxUp(sustained),maxDown:maxDown(sustained),
  shortUp:maxUp(short),shortDown:maxDown(short),avgUp:distance>0?gain/distance*100:null};
}
export function speedStats(points){
 if(points.some(p=>Number.isFinite(p.recordedDistance))){
  const samples=points.map(p=>p.speed).filter(v=>Number.isFinite(v)&&v>=0&&v<=150);
  if(samples.length)return {max:samples.reduce((m,v)=>Math.max(m,v),0),avg:avg(samples)};
 }
 const starts=runStarts(points),speeds=[],intervals=[];
 // Ventana de al menos 5 s para no confundir saltos aislados de GPS con velocidad real.
 // Se limita el tiempo entre muestras a 30 s y se rechazan desplazamientos físicamente
 // inverosímiles; el límite no sustituye una medición válida.
 for(let i=1;i<points.length;i++){
  const b=points[i],a=points[i-1];
  if(b.breakBefore||a.segmentId!==b.segmentId||!Number.isFinite(a.time)||!Number.isFinite(b.time))continue;
  const dt=b.time-a.time,dd=b.d-a.d;
  if(dt<=0||dt>30000||dd<0)continue;
  const raw=dd/dt*3600;
  if(!Number.isFinite(raw)||raw>100)continue;
  intervals.push({dt,dd});
  let j=i-1;
  while(j>starts[i]&&b.time-points[j].time<5000)j--;
  const windowMs=b.time-points[j].time,windowDist=b.d-points[j].d;
  if(windowMs<5000||windowMs>30000||windowDist<0)continue;
  // No se admite una ventana que contenga intervalos de tiempo inválidos.
  let valid=true;
  for(let k=j+1;k<=i;k++){
   const x=points[k],prev=points[k-1],step=x.time-prev.time;
   if(x.breakBefore||x.segmentId!==prev.segmentId||!Number.isFinite(step)||step<=0||step>30000||((x.d-prev.d)/step*3600)>100){valid=false;break}
  }
  if(valid)speeds.push(windowDist/windowMs*3600);
 }
 const ms=intervals.reduce((sum,x)=>sum+x.dt,0),distance=intervals.reduce((sum,x)=>sum+x.dd,0);
 return {max:speeds.length?speeds.reduce((m,v)=>Math.max(m,v),0):null,avg:ms>0?distance/ms*3600:null};
}
export function heartZones(points){
  const valid=points.filter(p=>Number.isFinite(p.hr));
  if(!valid.length)return [];
  const max=Math.max(...valid.map(p=>p.hr));
  const bounds=[0,.60,.70,.80,.90,1.01].map(x=>max*x);
  const ms=[0,0,0,0,0];
  for(let i=0;i<points.length-1;i++){
    const p=points[i],n=points[i+1];
    if(n.breakBefore||p.segmentId!==n.segmentId||!Number.isFinite(p.hr)||!p.time||!n.time)continue;
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
    const elapsed=continuousTime(seg);
    const sp=continuousSpeed(seg)??avg(seg.map(p=>p.speed).filter(Number.isFinite));
    rows.push({index:i+1,distance:(last.d-first.d)/1000,time:elapsed,speed:sp,up:Math.max(0,last.up-first.up),
      hr:hrs.length?avg(hrs):null,cad:cads.length?avg(cads):null});
  }
  return rows;
}
