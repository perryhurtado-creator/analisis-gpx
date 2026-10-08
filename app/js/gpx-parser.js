const all=(root,name)=>{const n=Array.from(root.getElementsByTagNameNS('*',name));return n.length?n:Array.from(root.getElementsByTagName(name))};
const childText=(node,name)=>{const n=all(node,name)[0];return n?n.textContent.trim():''};

export function optionalNumber(raw){
  if(raw==null||String(raw).trim()==='')return null;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function meters(a,b){
  const r=Math.PI/180,R=6371000,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;
  const x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

export function appendRuns(groups,parsePoint){
  const points=[];
  let nextSegmentId=0;
  for(const group of groups){
    let segmentId=null;
    for(const node of group){
      const point=parsePoint(node);
      if(!point){
        segmentId=null;
        continue;
      }
      if(segmentId===null){
        segmentId=nextSegmentId++;
        point.breakBefore=true;
      }else point.breakBefore=false;
      point.segmentId=segmentId;
      points.push(point);
    }
  }
  return points;
}

function parsePoint(node){
  const lat=optionalNumber(node.getAttribute('lat'));
  const lon=optionalNumber(node.getAttribute('lon'));
  if(lat===null||lon===null||lat < -90||lat > 90||lon < -180||lon > 180)return null;
  const ele=optionalNumber(childText(node,'ele'));
  const timeRaw=childText(node,'time');
  const parsedTime=timeRaw?Date.parse(timeRaw):NaN;
  const hr=optionalNumber(childText(node,'hr'));
  const cad=optionalNumber(childText(node,'cad'));
  const speed=optionalNumber(childText(node,'speed'));
  return {lat,lon,ele,time:Number.isFinite(parsedTime)?parsedTime:null,
    hr:hr!==null&&hr>0?hr:null,cad:cad!==null&&cad>0?cad:null,
    speed:speed!==null&&speed>0?speed*3.6:null,d:0,up:0};
}

export function parseGPX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror'))throw Error('El archivo no contiene XML válido.');
  const groups=all(xml,'trkseg').map(seg=>all(seg,'trkpt')).filter(points=>points.length);
  if(!groups.length)groups.push(all(xml,'trkpt'));
  const raw=groups.flat();
  if(raw.length<2)throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  return finalize(xml,appendRuns(groups,parsePoint),'GPX',file);
}

export function finalize(xml,p,type,file){
  if(p.length<2) throw Error('Los puntos no contienen coordenadas válidas.');
  let ascent=0,descent=0;
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    cur.d=prev.d;
    cur.up=prev.up;
    if(cur.breakBefore||cur.segmentId!==prev.segmentId)continue;
    const dd=meters(prev,cur);
    cur.d=prev.d+dd;
    const dt=cur.time&&prev.time?(cur.time-prev.time)/1000:null;
    if(dt&&dt>0&&dt<=30&&dd>=1)cur.speed=dd/dt*3.6;
  }
  const elevations=p.map((point,i)=>{
    if(!Number.isFinite(point.ele))return null;
    const values=[];
    const segmentId=point.segmentId;
    for(let j=Math.max(0,i-2);j<=Math.min(p.length-1,i+2);j++){
      if(p[j].segmentId!==segmentId)continue;
      if(Number.isFinite(p[j].ele))values.push(p[j].ele);
    }
    return values.length?values.reduce((s,v)=>s+v,0)/values.length:null;
  });
  let smoothUp=0,smoothDown=0,up=0;
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    cur.up=up;
    if(cur.breakBefore||cur.segmentId!==prev.segmentId)continue;
    const e1=elevations[i-1],e2=elevations[i];
    if(Number.isFinite(e1)&&Number.isFinite(e2)){
      const delta=e2-e1,dd=cur.d-prev.d;
      if(dd>=3&&Math.abs(delta)>=1){
        if(delta>0){smoothUp+=delta;up+=delta}else smoothDown-=delta;
      }
    }
    cur.up=up;
  }
  ascent=smoothUp;descent=smoothDown;
  const times=p.filter(x=>x.time).map(x=>x.time);
  return {points:p,name:childText(xml,'name')||file.replace(/\.(gpx|tcx)$/i,''),type,file,
    distance:p.at(-1).d,ascent,descent,duration:times.length>1?Math.max(...times)-Math.min(...times):null,
    start:times.length?Math.min(...times):null};
}
export {all,childText};
