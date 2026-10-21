import {localityBounds,localitiesAlongRoute,loadRouteLocalities} from './video-localities.js';

// El catálogo se descarga como recurso estático; no se envía el área de la ruta.
export async function posterLocalities(points,signal,{external=false,fetcher=fetch}={}){
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  if(points.length<2)return {places:[],message:'Sin localidades disponibles.'};
  const bbox=localityBounds(points);
  const [{regionalLocalities},{cachedLocalities}]=await Promise.all([
    import('./catalogues/localities-regional.mjs'),import('./catalogues/localities-cache.mjs')
  ]);
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  let places=localitiesAlongRoute(points,[...(cachedLocalities(bbox)||[]),...(regionalLocalities(bbox)||[])]);
  let message='Localidades del catálogo incluido.';
  if(external){
    try{places=localitiesAlongRoute(points,[...places,...await loadRouteLocalities(points,signal,fetcher)]);message='Localidades del catálogo y consulta por área.'}
    catch(error){if(signal.aborted)throw error;message='No se pudo ampliar la búsqueda; se usa el catálogo incluido.'}
  }
  const seen=new Set();places=places.filter(p=>{const key=p.name.toLocaleLowerCase('es-MX');if(seen.has(key))return false;seen.add(key);return true});
  // Repartir las etiquetas a lo largo del recorrido, no concentrarlas al inicio.
  if(places.length>7)places=Array.from({length:7},(_,i)=>places[Math.round(i*(places.length-1)/6)]);
  return {places:places.map(place=>{
    let index=0,nearest=Infinity;
    for(let i=0;i<points.length;i++){
      const p=points[i],gap=Math.hypot((p.lon-place.lon)*Math.cos(place.lat*Math.PI/180),p.lat-place.lat);
      if(gap<nearest){nearest=gap;index=i}
    }
    return {name:place.name.slice(0,26),index};
  }),message:places.length?message:external?'No se encontraron localidades cercanas.':'Sin localidades cercanas en el catálogo. Puedes ampliar la búsqueda.'};
}
