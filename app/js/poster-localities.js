import {localityBounds,fetchAreaLocalities} from './video-localities.js';
import {selectPosterLocalities} from './locality-selection.js';

// Sin lista de nombres: la selección sale de la categoría OSM (si existe), la población,
// la cercanía real a los tramos y el reparto sobre el mapa (ver locality-selection.js).
// El catálogo local es el punto de partida; la consulta en línea solo ocurre si la
// persona activó "Ampliar búsqueda en línea" (external). Así el aviso de privacidad es cierto.

function labelFor(points,place){
  let index=0,nearest=Infinity;
  for(let i=0;i<points.length;i++){
    const p=points[i],gap=Math.hypot((p.lon-place.lon)*Math.cos(place.lat*Math.PI/180),p.lat-place.lat);
    if(gap<nearest){nearest=gap;index=i}
  }
  return {name:place.name.slice(0,26),index,score:place.score,kind:place.kind,distance:place.distance};
}

export async function posterLocalities(points,signal,{external=false,fetcher=fetch}={}){
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  if(points.length<2)return {places:[],spares:[],message:'Sin localidades disponibles.'};
  const bbox=localityBounds(points);
  const [{regionalLocalities},{cachedLocalities}]=await Promise.all([
    import('./catalogues/localities-regional.mjs'),import('./catalogues/localities-cache.mjs')
  ]);
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  const candidates=[...(cachedLocalities(bbox)||[]),...(regionalLocalities(bbox)||[])];
  let message='Localidades reconocidas del catálogo.';
  if(external){
    try{
      candidates.push(...await fetchAreaLocalities(points,signal,fetcher));
      message='Localidades reconocidas del catálogo y consulta por área.';
    }catch(error){
      if(signal.aborted)throw error;
      message='No se pudo ampliar la búsqueda; se usa el catálogo incluido.';
    }
  }
  const {main,spares}=selectPosterLocalities(points,candidates,{max:7,spares:8});
  const byRoute=(a,b)=>a.distance-b.distance;
  return {
    places:main.map(place=>labelFor(points,place)).sort(byRoute),
    spares:spares.map(place=>labelFor(points,place)),
    message:main.length?message:'No se encontraron poblaciones reconocidas suficientemente cercanas a la ruta.'
  };
}
