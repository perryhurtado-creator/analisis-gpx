// Localidades reales de OSM; la proximidad se mide contra los tramos, nunca contra los cortes.
const cache=new Map(),METRES=111320;
const valid=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
export function localityBounds(points){
  let south=Infinity,north=-Infinity,west=Infinity,east=-Infinity;
  for(const p of points)if(valid(p)){south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lon);east=Math.max(east,p.lon)}
  if(!Number.isFinite(south))throw Error('La ruta no tiene coordenadas válidas.');
  return [Math.floor((south-.012)*100)/100,Math.floor((west-.012)*100)/100,Math.ceil((north+.012)*100)/100,Math.ceil((east+.012)*100)/100];
}
export function localitiesAlongRoute(points,places,maxDistance=900){
  const result=[];
  for(const place of places){
    if(!valid(place)||typeof place.name!=='string'||!place.name.trim())continue;
    const cos=Math.cos(place.lat*Math.PI/180);let nearest=Infinity,at=0;
    for(let i=0;i<points.length;i++){
      const a=points[i];if(!valid(a))continue;
      const b=points[i+1],continuous=valid(b)&&!b.breakBefore&&a.segmentId===b.segmentId;
      const ax=(a.lon-place.lon)*METRES*cos,ay=(a.lat-place.lat)*METRES;
      const dx=continuous?(b.lon-a.lon)*METRES*cos:0,dy=continuous?(b.lat-a.lat)*METRES:0;
      const mix=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
      const distance=Math.hypot(ax+mix*dx,ay+mix*dy);
      if(distance<nearest){nearest=distance;at=Number.isFinite(a.d)?a.d+(continuous&&Number.isFinite(b.d)?(b.d-a.d)*mix:0):i}
    }
    if(nearest<=maxDistance&&!result.some(p=>p.name===place.name&&Math.hypot((p.lon-place.lon)*METRES*cos,(p.lat-place.lat)*METRES)<200))result.push({...place,name:place.name.trim().slice(0,100),distance:at,offset:nearest});
  }
  return result.sort((a,b)=>a.distance-b.distance).slice(0,160);
}
export function visibleLocalities(places,distance,total){
  const window=Math.max(1400,Math.min(6500,total*.10));
  return places.map((place,index)=>({index,gap:Math.abs(place.distance-distance)})).filter(p=>p.gap<window).sort((a,b)=>a.gap-b.gap).slice(0,3).map(p=>({...p,alpha:Math.min(1,(window-p.gap)/(window*.3))}));
}
export async function loadRouteLocalities(points,signal,fetcher=fetch){
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  const bbox=localityBounds(points).join(',');let places=cache.get(bbox);
  if(!places){
    const response=await fetcher('/api/localities?bbox='+encodeURIComponent(bbox),{signal});
    if(!response.ok)throw Error('No se pudieron consultar los nombres de localidades.');
    const data=await response.json();if(!Array.isArray(data.places))throw Error('Respuesta de localidades inválida.');
    if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
    places=data.places.slice(0,1000);if(cache.size>=5)cache.delete(cache.keys().next().value);cache.set(bbox,places);
  }
  return localitiesAlongRoute(points,places);
}
