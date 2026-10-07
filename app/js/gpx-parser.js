const all=(root,name)=>{
  if(!root)return[];
  const namespaced=typeof root.getElementsByTagNameNS==='function'
    ?Array.from(root.getElementsByTagNameNS('*',name))
    :[];
  return namespaced.length?namespaced:Array.from(root.getElementsByTagName?.(name)||[]);
};
const childText=(node,name)=>{const n=all(node,name)[0];return n?n.textContent.trim():''};

export function optionalNumber(raw){
  if(raw==null||String(raw).trim()==='')return null;
  const value=Number(raw);
  return Number.isFinite(value)?value:null;
}

export function validCoordinates(lat,lon){
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180;
}

export function isConnected(a,b){
  if(!a||!b||b.breakBefore)return false;
  return a.segmentId==null||b.segmentId==null||a.segmentId===b.segmentId;
}

export function collectTrackPoints(groups,readPoint){
  const points=[];
  let nextSegmentId=0;
  for(const group of groups){
    let activeSegmentId=null;
    for(const node of group){
      const point=readPoint(node);
      if(!point){activeSegmentId=null;continue}
      if(activeSegmentId===null)activeSegmentId=nextSegmentId++;
      const previous=points.at(-1);
      point.segmentId=activeSegmentId;
      point.breakBefore=!previous||previous.segmentId!==activeSegmentId;
      point.d=0;
      point.up=0;
      points.push(point);
    }
  }
  return points;
}

function meters(a,b){
  const r=Math.PI/180,R=6371000,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;
  const x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
  const h=Math.max(0,Math.min(1,x));
  return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
}

function parseTime(raw){
  if(!raw||!raw.trim())return null;
  const time=Date.parse(raw);
  return Number.isFinite(time)?time:null;
}

export function parseGPX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector?.('parsererror'))throw Error('El archivo no contiene XML válido.');
  const trackSegments=all(xml,'trkseg').map(seg=>all(seg,'trkpt')).filter(group=>group.length);
  const groups=trackSegments.length?trackSegments:[all(xml,'trkpt')];
  if(groups.reduce((sum,group)=>sum+group.length,0)<2)
    throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  const points=collectTrackPoints(groups,node=>{
    const lat=optionalNumber(node.getAttribute('lat'));
    const lon=optionalNumber(node.getAttribute('lon'));
    if(!validCoordinates(lat,lon))return null;
    const speed=optionalNumber(childText(node,'speed'));
    const hr=optionalNumber(childText(node,'hr'));
    const cadence=optionalNumber(childText(node,'cad'));
    return{
      lat,lon,
      ele:optionalNumber(childText(node,'ele')),
      time:parseTime(childText(node,'time')),
      hr:hr!==null&&hr>0?hr:null,
      cad:cadence!==null&&cadence>0?cadence:null,
      speed:speed!==null&&speed>0?speed*3.6:null
    };
  });
  return finalize(xml,points,'GPX',file);
}

export function finalize(xml,p,type,file){
  if(p.length<2)throw Error('Los puntos no contienen coordenadas válidas.');
  p[0].d=0;
  p[0].up=0;
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    cur.d=prev.d;
    cur.up=prev.up;
    if(!isConnected(prev,cur))continue;
    const dd=meters(prev,cur);
    cur.d=prev.d+dd;
    const dt=Number.isFinite(cur.time)&&Number.isFinite(prev.time)?(cur.time-prev.time)/1000:null;
    if(dt!==null&&dt>0&&dt<=30&&dd>=1)cur.speed=dd/dt*3.6;
  }

  const elevations=p.map((point,i)=>{
    if(!Number.isFinite(point.ele))return null;
    const start=Math.max(0,i-2),end=Math.min(p.length-1,i+2),values=[];
    for(let j=start;j<=end;j++){
      let connected=true;
      for(let k=Math.min(i,j)+1;k<=Math.max(i,j);k++){
        if(!isConnected(p[k-1],p[k])){connected=false;break}
      }
      if(connected&&Number.isFinite(p[j].ele))values.push(p[j].ele);
    }
    return values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
  });

  let ascent=0,descent=0,up=0;
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    if(isConnected(prev,cur)){
      const e1=elevations[i-1],e2=elevations[i];
      if(Number.isFinite(e1)&&Number.isFinite(e2)){
        const delta=e2-e1,dd=cur.d-prev.d;
        if(dd>=3&&Math.abs(delta)>=1){
          if(delta>0){ascent+=delta;up+=delta}
          else descent-=delta;
        }
      }
    }
    cur.up=up;
  }

  let start=null,end=null;
  for(const point of p){
    if(!Number.isFinite(point.time))continue;
    start=start===null?point.time:Math.min(start,point.time);
    end=end===null?point.time:Math.max(end,point.time);
  }
  return{
    points:p,
    name:childText(xml,'name')||file.replace(/\.(gpx|tcx)$/i,''),
    type,file,
    distance:p.at(-1).d,
    ascent,descent,
    duration:start!==null&&end!==null&&end>start?end-start:null,
    start
  };
}

export{all,childText};
