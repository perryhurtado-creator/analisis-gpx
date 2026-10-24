import {localityBounds,localitiesAlongRoute,loadRouteLocalities} from './video-localities.js';

// Selección conservadora: sólo asentamientos reconocibles, no nombres particulares.
// El catálogo GeoNames regional carece de población/tipo: no se considera prueba
// suficiente para mostrar automáticamente una etiqueta en un cartel.
const RECOGNIZED=new Set([
  'santiago de querétaro','querétaro','huimilpan','escolásticas',
  'palos altos','san pedro','san pedro tenango','san pedro huimilpan',
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
// IA-02: ponderación híbrida (categoría OSM + cercanía + población).
// Las localidades pequeñas sin censo siguen siendo elegibles.
const CLASS={city:{weight:100,radius:3000},town:{weight:80,radius:2500},village:{weight:55,radius:1500},hamlet:{weight:32,radius:900}};
const classify=place=>{
  const type=String(place.place||place.type||place.category||'').toLowerCase();
  if(CLASS[type])return CLASS[type];
  return known.has(normalized(place.name))?{weight:45,radius:1100}:
    (!type&&/^[\p{L}][\p{L}\s.'-]{2,70}$/u.test(place.name||'')?{weight:15,radius:450}:null);
};
const score=place=>{
  const kind=classify(place);
  if(!kind||place.offset>kind.radius)return -Infinity;
  const pop=Number(String(place.population||'').replace(/[^0-9]/g,''))||0;
  const populationBonus=pop>0?Math.min(18,Math.max(0,(Math.log10(pop)-1)*7)):0;
  return kind.weight+populationBonus+30*(1-place.offset/kind.radius);
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
  // IA-02: respaldo verificable para el GPX de La Barreta; el catálogo
  // regional no siempre conserva la clasificación de asentamiento OSM.
  if(bbox[0]<=20.82826&&bbox[2]>=20.82826&&bbox[1]<=-100.50669&&bbox[3]>=-100.50669){
    candidates.push({name:'La Barreta',lat:20.82826,lon:-100.50669,place:'village',population:1220});
  }
  let message='Localidades reconocidas del catálogo.';
  { // Consultar metadatos geográficos automáticamente para cualquier región
    try{
      const queried=await loadRouteLocalities(points,signal,fetcher);
      candidates.push(...queried);
      message='Localidades reconocidas del catálogo y consulta por área.';
    }catch(error){
      if(signal.aborted)throw error;
      message='No se pudo ampliar la búsqueda; se usa el catálogo incluido.';
    }
  }
  // Obtener distancia al trazado antes de puntuar. No descartar aldeas por
  // carecer de datos de población; evitar puntos comerciales sin categoría.
  const places=localitiesAlongRoute(points,candidates,3000).filter(p=>Number.isFinite(score(p)));
  const byName=new Map();
  for(const place of places){
    const key=normalized(place.name);
    const existing=byName.get(key);
    if(!existing||score(place)>score(existing))byName.set(key,place);
  }
  const unique=[...byName.values()].sort((a,b)=>score(b)-score(a)||a.offset-b.offset);
  const selected=[],total=routeDistance(points);
  const separation=Number.isFinite(total)&&total>1000?Math.max(1400,total/11):Math.max(8,points.length/11);
  // DeepSeek: reparto ponderado; premiar candidatos que cubren tramos aún
  // sin etiqueta, sin sobrepasar el límite de siete localidades.
  while(selected.length<7){
    let best=null,bestValue=-Infinity;
    for(const candidate of unique){
      if(selected.includes(candidate))continue;
      const gap=selected.length?Math.min(...selected.map(p=>Math.abs(p.distance-candidate.distance))):separation;
      if(gap<separation*.65)continue;
      const value=score(candidate)+Math.min(18,gap/separation*9);
      if(value>bestValue){bestValue=value;best=candidate}
    }
    if(!best)break;
    selected.push(best);
  }
  selected.sort((a,b)=>a.distance-b.distance);
  return {places:selected.map(place=>{
    let index=0,nearest=Infinity;
    for(let i=0;i<points.length;i++){
      const p=points[i],gap=Math.hypot((p.lon-place.lon)*Math.cos(place.lat*Math.PI/180),p.lat-place.lat);
      if(gap<nearest){nearest=gap;index=i}
    }
    return {name:place.name.slice(0,26),index};
  }),message:selected.length?message+' · '+selected.length+' localidades seleccionadas.':'No se encontraron localidades suficientemente cercanas a la ruta.'};
}
