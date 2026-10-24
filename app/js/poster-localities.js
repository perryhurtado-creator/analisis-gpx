import {localityBounds,localitiesAlongRoute,loadRouteLocalities} from './video-localities.js';

// Selección conservadora: sólo asentamientos reconocibles, no nombres particulares.
// El catálogo GeoNames regional carece de población/tipo: no se considera prueba
// suficiente para mostrar automáticamente una etiqueta en un cartel.
const RECOGNIZED=new Set([
  'santiago de querétaro','querétaro','huimilpan','escolásticas',
  'ajuchitlancito','la venta de ajuchitlancito','dolores de ajuchitlancito',
  'lagunillas','el vegil','el rosario','san cirilo','san fandila',
  'san isidro miranda','san pedro mártir','santa teresa','san rafael',
  'las taponas','apapátaro','san francisco nevería','la ceja',
  'san josé tepuzas','el salitrillo','calamanda','palo alto',
  'san antonio la galera','general lázaro cárdenas (el colorado)',
  'el colorado','el pueblito','corregidora','amealco de bonfil',
  'amealco','san juan del río','pedro escobedo','colón','tolimán',
  'tequisquiapan','ezequiel montes','bernal','juriquilla'
]);
const normalized=name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();
const known=new Set([...RECOGNIZED].map(normalized));
const rank=place=>{
  const category=place.place||place.type||place.category||'';
  const population=Number(place.population)||0;
  if(['city','town'].includes(category))return 4;
  if(category==='village')return 3;
  if(known.has(normalized(place.name)))return 3;
  if(category==='hamlet'&&population>=500)return 2;
  return 0;
};
const routeDistance=points=>points.at(-1)?.d||points.length;

export async function posterLocalities(points,signal,{external=false,fetcher=fetch}={}){
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  if(points.length<2)return {places:[],message:'Sin localidades disponibles.'};
  const bbox=localityBounds(points);
  const [{regionalLocalities},{cachedLocalities}]=await Promise.all([
    import('./catalogues/localities-regional.mjs'),import('./catalogues/localities-cache.mjs')
  ]);
  if(signal.aborted)throw new DOMException('Cancelado.','AbortError');
  const candidates=[...(cachedLocalities(bbox)||[]),...(regionalLocalities(bbox)||[])];
  let message='Localidades reconocidas del catálogo.';
  if(external){
    try{
      const queried=await loadRouteLocalities(points,signal,fetcher);
      candidates.push(...queried);
      message='Localidades reconocidas del catálogo y consulta por área.';
    }catch(error){
      if(signal.aborted)throw error;
      message='No se pudo ampliar la búsqueda; se usa el catálogo incluido.';
    }
  }
  // La cercanía al trazado es obligatoria. Evitar elegir por orden del catálogo.
  const places=localitiesAlongRoute(points,candidates,900)
    .filter(place=>rank(place)>0)
    .sort((a,b)=>rank(b)-rank(a)||a.offset-b.offset);
  const unique=[],seen=new Set();
  for(const place of places){
    const key=normalized(place.name);
    if(seen.has(key))continue;
    seen.add(key);unique.push(place);
  }
  // No completar artificialmente siete etiquetas. Favorecer importancia y
  // separación a lo largo de la ruta para evitar saturación visual.
  const selected=[];
  const total=routeDistance(points);
  const separation=Number.isFinite(total)&&total>1000?Math.max(2000,total/9):Math.max(8,points.length/9);
  for(const place of unique){
    if(selected.length>=7)break;
    if(selected.some(other=>Math.abs(other.distance-place.distance)<separation))continue;
    selected.push(place);
  }
  selected.sort((a,b)=>a.distance-b.distance);
  return {places:selected.map(place=>{
    let index=0,nearest=Infinity;
    for(let i=0;i<points.length;i++){
      const p=points[i],gap=Math.hypot((p.lon-place.lon)*Math.cos(place.lat*Math.PI/180),p.lat-place.lat);
      if(gap<nearest){nearest=gap;index=i}
    }
    return {name:place.name.slice(0,26),index};
  }),message:selected.length?message:'No se encontraron poblaciones reconocidas suficientemente cercanas a la ruta.'};
}
