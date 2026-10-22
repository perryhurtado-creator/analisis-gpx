import {elevationCoverage} from './elevation.js';
export const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export const fmt=(v,n=1)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:n}).format(v);
export function duration(ms,{seconds=false}={}){
  if(!Number.isFinite(ms)||ms<=0)return '—';
  let s=Math.round(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),sec=s%60;
  if(seconds)return h?`${h} h ${m} min ${sec} s`:(m?`${m} min ${sec} s`:`${sec} s`);
  return h?`${h} h ${m} min`:(m?`${m} min`:`${sec} s`);
}
export const stamp=ms=>new Date(ms).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'});
export function averageSpeed(points){
  const samples=points.filter(p=>p.speedSource!=='gps'&&Number.isFinite(p.recordedDistance)).map(p=>p.speed).filter(v=>Number.isFinite(v)&&v>=0&&v<=150);
  if(samples.length)return {value:avg(samples),source:'sensor',method:'Media de muestras de velocidad del TCX'};
  const continuous=continuousSpeed(points);
  if(continuous!==null)return {value:continuous,source:'gps',method:'Distancia GPS / tiempo entre puntos continuos'};
  const speeds=points.map(p=>p.speed).filter(v=>Number.isFinite(v)&&v>=0&&v<=150);
  return {value:avg(speeds),source:speeds.length?'samples':'absent',method:speeds.length?'Media de muestras disponibles':'Sin datos de velocidad'};
}
export function elevationText(activity,field='ascent'){
  const value=activity[field],coverage=elevationCoverage(activity.points);
  return coverage==='absent'||!Number.isFinite(value)?'Sin datos':(field==='ascent'?'+':'−')+fmt(value)+' m'+(coverage==='partial'?' (parcial)':'');
}
export function summary(a){
  const ps=a.points,hrs=ps.map(p=>p.hr).filter(Number.isFinite),cads=ps.map(p=>p.cad).filter(Number.isFinite);
  const km=a.distance/1000;
  const sp=averageSpeed(ps).value;
  return {distance:fmt(km)+' km',time:duration(a.duration),speed:sp!==null?fmt(sp)+' km/h':'—',
    ascent:elevationText(a),heart:hrs.length?Math.round(avg(hrs))+' lpm':'—',
    cadence:cads.length?Math.round(avg(cads))+' rpm':'—'};
}
function runStarts(points){
  let start=0;
  return points.map((p,i)=>{if(i===0||p.breakBefore||p.segmentId!==points[i-1].segmentId)start=i;return start});
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
 const slopes=[];let j=0,lastMissing=-1;
 for(let i=1;i<points.length;i++){
  const cur=points[i],first=starts[i];
  if(!Number.isFinite(points[i-1].ele))lastMissing=i-1;
  if(i<=first||!Number.isFinite(cur.ele))continue;
  j=Math.max(j,first,lastMissing+1);
  if(j>=i)continue;
  // El extremo izquierdo solo avanza: coste lineal incluso durante paradas.
  while(j+1<i&&cur.d-points[j+1].d>=windowM)j++;
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
export function heartZones(points,settings={}){
  const valid=points.filter(p=>Number.isFinite(p.hr));
  if(!valid.length)return [];
  const max=Number(settings.max),rest=Number(settings.rest),reserve=settings.method==='reserve';
  if(!Number.isFinite(max)||max<80||max>240||reserve&&(!Number.isFinite(rest)||rest<20||rest>=max))return [];
  const base=reserve?rest:0,span=max-base;
  const bounds=[0,.60,.70,.80,.90].map(x=>base+span*x);bounds[0]=0;
  const ms=[0,0,0,0,0];
  for(let i=0;i<points.length-1;i++){
    const p=points[i],n=points[i+1];
    if(n.breakBefore||p.segmentId!==n.segmentId||!Number.isFinite(p.hr)||!Number.isFinite(p.time)||!Number.isFinite(n.time))continue;
    const dt=n.time-p.time;
    if(dt<=0||dt>120000)continue;
    let z=0;
    if(p.hr>=bounds[4])z=4;else if(p.hr>=bounds[3])z=3;else if(p.hr>=bounds[2])z=2;else if(p.hr>=bounds[1])z=1;
    ms[z]+=dt;
  }
  if(!ms.some(n=>n>0))return [];
  return ms.map((time,i)=>({zone:i+1,min:bounds[i],max:i===4?null:bounds[i+1],time}));
}
export function segments(activity){
  const {points,distance:total}=activity;
  if(!Number.isFinite(total)||total<=0||points.length<2)return [];
  const bins=Array.from({length:5},()=>({distance:0,time:0,timedDistance:0,up:0,hasUp:false,hr:[],cad:[],speed:[]}));
  const at=d=>Math.min(4,Math.max(0,Math.floor(d/total*5)));
  // Conservar la media de muestras de sensores dentro de cada tramo.
  for(const p of points){
    if(!Number.isFinite(p.d)||p.d<0||p.d>total)continue;
    const bin=bins[at(p.d)];
    for(const key of ['hr','cad','speed'])if(Number.isFinite(p[key]))bin[key].push(p[key]);
  }
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(b.breakBefore||a.segmentId!==b.segmentId||!Number.isFinite(a.d)||!Number.isFinite(b.d)||b.d<a.d)continue;
    const dd=b.d-a.d;
    const dt=Number.isFinite(a.time)&&Number.isFinite(b.time)&&b.time>a.time?b.time-a.time:null;
    // Una parada pertenece a un solo tramo, incluso al final de la actividad.
    if(dd===0){if(dt!==null&&b.d>=0&&b.d<=total)bins[at(b.d)].time+=dt;continue}
    for(let k=0;k<5;k++){
      const from=Math.max(a.d,total*k/5),to=Math.min(b.d,total*(k+1)/5),overlap=to-from;
      if(overlap<=0)continue;
      const bin=bins[k],fraction=overlap/dd;
      bin.distance+=overlap;
      // Interpolar el tiempo en cada límite sin duplicar ni perder intervalos.
      if(dt!==null){bin.time+=dt*fraction;bin.timedDistance+=overlap}
      if(Number.isFinite(a.up)&&Number.isFinite(b.up)){
        bin.up+=Math.max(0,b.up-a.up)*fraction;bin.hasUp=true;
      }
    }
  }
  return bins.map((bin,i)=>({index:i+1,distance:bin.distance/1000,time:bin.time||null,
    speed:bin.time>0?bin.timedDistance/bin.time*3600:avg(bin.speed),
    up:bin.hasUp?bin.up:null,hr:avg(bin.hr),cad:avg(bin.cad)}));
}
