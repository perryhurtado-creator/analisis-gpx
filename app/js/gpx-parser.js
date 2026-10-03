const all=(root,name)=>{const n=Array.from(root.getElementsByTagNameNS('*',name));return n.length?n:Array.from(root.getElementsByTagName(name))};
const childText=(node,name)=>{const n=all(node,name)[0];return n?n.textContent.trim():''};

function meters(a,b){
  const r=Math.PI/180,R=6371000,dl=(b.lat-a.lat)*r,dn=(b.lon-a.lon)*r;
  const x=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dn/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}

export function parseGPX(xmlText,file){
  const xml=new DOMParser().parseFromString(xmlText,'application/xml');
  if(xml.querySelector('parsererror')) throw Error('El archivo no contiene XML válido.');
  const raw=all(xml,'trkpt');
  if(raw.length<2) throw Error('No encontré suficientes puntos de recorrido en este archivo.');
  return buildActivity(xml,raw,'GPX',file);
}

function buildActivity(xml,raw,type,file){
  const p=[];
  for(const node of raw){
    const lat=Number(node.getAttribute('lat')),lon=Number(node.getAttribute('lon'));
    const ele=Number(childText(node,'ele')),time=Date.parse(childText(node,'time'));
    const hr=Number(childText(node,'hr')),cad=Number(childText(node,'cad')),speed=Number(childText(node,'speed'));
    if(Number.isFinite(lat)&&Number.isFinite(lon)){
      p.push({lat,lon,ele:Number.isFinite(ele)?ele:null,time:Number.isFinite(time)?time:null,
        hr:Number.isFinite(hr)&&hr>0?hr:null,cad:Number.isFinite(cad)&&cad>0?cad:null,
        speed:Number.isFinite(speed)&&speed>0?speed*3.6:null,d:0,up:0});
    }
  }
  return finalize(xml,p,type,file);
}

export function finalize(xml,p,type,file){
  if(p.length<2) throw Error('Los puntos no contienen coordenadas válidas.');
  let ascent=0,descent=0;
  for(let i=1;i<p.length;i++){
    const prev=p[i-1],cur=p[i];
    cur.d=prev.d+meters(prev,cur);
    if(cur.ele!==null&&prev.ele!==null){
      const delta=cur.ele-prev.ele;
      if(delta>0){ascent+=delta;cur.up=prev.up+delta}
      else{descent-=delta;cur.up=prev.up}
    }else cur.up=prev.up;
    const dt=cur.time&&prev.time?(cur.time-prev.time)/1000:null;
    if(!cur.speed&&dt&&dt>0&&dt<600) cur.speed=(cur.d-prev.d)/dt*3.6;
  }
  const times=p.filter(x=>x.time).map(x=>x.time);
  return {points:p,name:childText(xml,'name')||file.replace(/\.(gpx|tcx)$/i,''),type,file,
    distance:p.at(-1).d,ascent,descent,duration:times.length>1?Math.max(...times)-Math.min(...times):null,
    start:times.length?Math.min(...times):null};
}

export {all,childText};
