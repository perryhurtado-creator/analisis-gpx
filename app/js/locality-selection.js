// Selección automática de localidades para el cartel. No usa listas de nombres:
// decide por categoría OSM (si la hay), población, cercanía real a los tramos y
// reparto sobre el mapa. Módulo puro (sin DOM ni red) para poder probarlo.
import {localitiesAlongRoute} from './video-localities.js';

const METRES=111320;
const valid=p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;

export const normalizeName=name=>String(name??'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLocaleLowerCase('es-MX').replace(/\s+/g,' ').trim();

// Peso = importancia geográfica; radius = distancia máxima al trazado (m) a la que
// el lugar sigue siendo "del recorrido". Las ciudades se ven desde más lejos.
// "unclassified" es el catálogo GeoNames: sin categoría, por eso es el escalón más débil.
export const PLACE_CLASSES={
  city:{weight:100,radius:3000},
  town:{weight:80,radius:2500},
  village:{weight:55,radius:1500},
  hamlet:{weight:30,radius:900},
  unclassified:{weight:12,radius:600}
};
const URBAN_SUBDIVISIONS=new Set(['suburb','neighbourhood','neighborhood','quarter','borough','city_block']);
// Solo se aplica a lugares SIN categoría OSM: propiedades, fraccionamientos y establecimientos.
const NOT_A_SETTLEMENT=/^(rancho|ranchos|hacienda|ex[ -]?hacienda|granja|granjas|finca|fraccionamiento|fracc|fraccion|residencial|condominio|club|colonia|puerta de|campo|parque|balneario|hotel|motel|restaurante|restaurant|gasolinera|bodega|ladrillera|banco|mina|aserradero|cantera|presa|bordo|unidad habitacional|centro de readaptacion|cereso|hospital|escuela|universidad|aeropuerto|cementerio|panteon|mercado)\b|\b(sector|fraccionamiento|residencial)\b/;

export const populationOf=value=>{
  const digits=String(value??'').replace(/[\s,.']/g,'');
  return /^\d{1,9}$/.test(digits)?Number(digits):0;
};
const categoryOf=place=>String(place?.place||place?.type||place?.category||'').toLowerCase();

export function classifyPlace(place){
  const name=String(place?.name??'').trim();
  if(!name)return {excluded:true,reason:'sin-nombre'};
  const category=categoryOf(place);
  if((!category||category==='unclassified'||category==='hamlet')&&/^(hotel|motel|restaurante|gasolinera|granja|granjas|finca|rancho|hacienda)\b/.test(normalizeName(name)))return {excluded:true,reason:'nombre-de-establecimiento'};
  if(category&&category!=='unclassified'){
    if(category!=='unclassified'&&PLACE_CLASSES[category])return {kind:category,...PLACE_CLASSES[category]};
    if(URBAN_SUBDIVISIONS.has(category))return {excluded:true,reason:'subdivision-urbana'};
    return {excluded:true,reason:'categoria-no-admitida'};
  }
  const full=normalizeName(name);
  // Los alias entre paréntesis o corchetes ("Lugar (Rancho X)") no cuentan como el nombre principal.
  const primary=full.replace(/\s*[(\[].*$/,'').trim();
  if(/^(barrio|seccion)\b|\bmanzana\b/.test(primary))return {excluded:true,reason:'subdivision-urbana'};
  if(primary.length>34||/\d/.test(primary)||/^familia\b/.test(primary)||NOT_A_SETTLEMENT.test(primary)||/\b(sector|fraccionamiento|residencial)\b/.test(full))return {excluded:true,reason:'nombre-de-establecimiento'};
  return {kind:'unclassified',...PLACE_CLASSES.unclassified};
}

const weightOf=place=>{const c=categoryOf(place);return c&&c!=='unclassified'&&PLACE_CLASSES[c]?PLACE_CLASSES[c].weight:0};
const metres=(a,b)=>{const cos=Math.cos((a.lat+b.lat)/2*Math.PI/180);return Math.hypot((a.lon-b.lon)*METRES*cos,(a.lat-b.lat)*METRES)};

// Une el mismo lugar reportado por varias fuentes (mismo nombre a menos de joinDistance).
// Mismo nombre y coordenadas lejanas = localidades distintas: no se colapsan.
// La entrada con categoría OSM manda sobre la del catálogo, sin importar el orden.
export function mergePlaces(places,joinDistance=1000){
  const groups=new Map();
  for(const place of places){
    if(!valid(place)||typeof place.name!=='string'||!place.name.trim())continue;
    const key=normalizeName(place.name);
    const list=groups.get(key)||[];groups.set(key,list);
    const existing=list.find(other=>metres(other,place)<=joinDistance);
    if(!existing){list.push({...place,name:place.name.trim().slice(0,100)});continue}
    if(weightOf(place)>weightOf(existing)){existing.place=categoryOf(place);existing.lat=place.lat;existing.lon=place.lon}
    if(populationOf(place.population)>populationOf(existing.population))existing.population=place.population;
  }
  return [...groups.values()].flat();
}

// Reduce puntos para acelerar la proyección. Conserva el inicio y el final de cada tramo,
// de modo que los cortes siguen sin unirse. El error es menor que `step` metros.
function simplifyRoute(points,step=30){
  const out=[];let last=null;
  points.forEach((p,i)=>{
    if(!valid(p))return;
    const next=points[i+1];
    const starts=!last||p.breakBefore||p.segmentId!==last.segmentId;
    const ends=!next||next.breakBefore||next.segmentId!==p.segmentId;
    if(starts||ends||metres(last,p)>=step){out.push(p);last=p}
  });
  return out;
}

const brief=(p,extra)=>({name:p.name,lat:p.lat,lon:p.lon,...extra});

// Puntúa los lugares cercanos al recorrido. Devuelve también lo descartado y por qué,
// para poder explicar por qué una localidad concreta no aparece.
export function rankLocalities(points,places,{maxDistance=3000}={}){
  const accepted=[],rejected=[];
  const route=simplifyRoute(points);
  if(!route.length)return {accepted,rejected};
  const margin=maxDistance/METRES,cosMax=Math.cos(Math.max(...route.map(p=>Math.abs(p.lat)))*Math.PI/180)||1;
  const box=route.reduce((b,p)=>({s:Math.min(b.s,p.lat),n:Math.max(b.n,p.lat),w:Math.min(b.w,p.lon),e:Math.max(b.e,p.lon)}),{s:Infinity,n:-Infinity,w:Infinity,e:-Infinity});
  const nearBox=places.filter(p=>valid(p)&&p.lat>=box.s-margin&&p.lat<=box.n+margin&&p.lon>=box.w-margin/cosMax&&p.lon<=box.e+margin/cosMax);
  const eligible=[];
  for(const place of mergePlaces(nearBox)){
    const info=classifyPlace(place);
    if(info.excluded){rejected.push(brief(place,{reason:info.reason}));continue}
    eligible.push({...place,...info});
  }
  for(const place of localitiesAlongRoute(route,eligible,maxDistance,{limit:Infinity})){
    // 1 m de tolerancia: una distancia nominal de 900 m no debe fallar por redondeo.
    if(place.offset>place.radius+1){rejected.push(brief(place,{reason:'fuera-de-radio',offset:Math.round(place.offset),radius:place.radius}));continue}
    const population=populationOf(place.population);
    const importance=place.weight+Math.min(20,Math.max(0,(Math.log10(population||1)-1)*8));
    const proximity=30*(1-Math.min(1,place.offset/place.radius));
    accepted.push({name:place.name,lat:place.lat,lon:place.lon,kind:place.kind,population:population||null,
      offset:place.offset,distance:place.distance,score:importance+proximity});
  }
  return {accepted,rejected};
}

// Selección voraz: primero lo más importante y cercano, con un bono por cubrir tramos
// aún sin etiqueta y una distancia mínima sobre el mapa para no apilar nombres.
export function selectSpread(candidates,{total=1,max=7,minMapGap=0,seeds=[],minRouteGap=0}={}){
  const pool=[...candidates].sort((a,b)=>b.score-a.score||a.offset-b.offset||a.name.localeCompare(b.name,'es'));
  const selected=seeds.slice(0,max),span=Math.max(total,1);
  for(const seed of selected){const i=pool.indexOf(seed);if(i>=0)pool.splice(i,1)}
  while(selected.length<max&&pool.length){
    let best=-1,bestValue=-Infinity;
    pool.forEach((c,i)=>{
      let routeGap=Infinity,mapGap=Infinity;
      for(const s of selected){routeGap=Math.min(routeGap,Math.abs(s.distance-c.distance));mapGap=Math.min(mapGap,metres(s,c))}
      if(mapGap<minMapGap||routeGap<minRouteGap)return;
      const spread=Number.isFinite(routeGap)?Math.min(1,routeGap/(span/4)):1;
      const value=c.score+12*spread;
      if(value>bestValue){bestValue=value;best=i}
    });
    if(best<0)break;
    selected.push(pool.splice(best,1)[0]);
  }
  return {selected,rest:pool.map(c=>({...c,reason:selected.length>=max?'limite':'cerca-de-etiqueta-mejor'}))};
}

export function routeLength(points){
  for(let i=points.length-1;i>=0;i--)if(Number.isFinite(points[i]?.d))return points[i].d;
  return 0;
}

// Orquesta todo. `main` son las etiquetas elegidas; `spares` son sustitutas ordenadas
// por si el dibujo no encuentra espacio para alguna.
export function selectPosterLocalities(points,places,{max=7,spares=8}={}){
  const ranked=rankLocalities(points,places);
  // Población ausente no significa lugar irrelevante. El catálogo sigue siendo
  // respaldo, con menos etiquetas y reparto; las categorías conocidas mandan.
  const relevant=ranked.accepted;
  const secondary=c=>!['city','town','village'].includes(c.kind);
  const valids=points.filter(valid);
  const lats=valids.map(p=>p.lat),lons=valids.map(p=>p.lon);
  const diagonal=lats.length?metres({lat:Math.min(...lats),lon:Math.min(...lons)},{lat:Math.max(...lats),lon:Math.max(...lons)}):0;
  const total=routeLength(points)||diagonal;
  const minMapGap=Math.max(250,diagonal/25),seeds=[];
  // Un extremo se identifica por distancia directa al punto real, incluso en bucles.
  // No se inventa una localidad para un extremo sin candidatos suficientemente cerca.
  for(const endpoint of [valids[0],valids.at(-1)]){
    if(!endpoint||seeds.length>=max)continue;
    const nearby=relevant.filter(c=>metres(c,endpoint)<=Math.min(1500,PLACE_CLASSES[c.kind].radius));
    const isMajor=c=>['city','town','village'].includes(c.kind)?1:0;
    nearby.sort((a,b)=>isMajor(a)-isMajor(b)||(a.score-metres(a,endpoint)/20)-(b.score-metres(b,endpoint)/20));
    const best=nearby.at(-1);
    if(best&&!seeds.some(s=>metres(s,best)<minMapGap))seeds.push(best);
  }
  const major=relevant.filter(c=>!secondary(c));
  const primary=selectSpread(major,{total,max,minMapGap,seeds}).selected;
  // Los secundarios completan huecos: no desplazan principales ni se amontonan
  // en un tramo ya representado. El umbral se adapta a rutas cortas y largas.
  const secondaryLimit=major.length?2:5;
  const secondarySlots=Math.max(0,secondaryLimit-primary.filter(secondary).length);
  const selected=selectSpread(relevant,{total,max:Math.min(max,primary.length+secondarySlots),minMapGap,seeds:primary,
    minRouteGap:Math.max(250,total/(Math.max(max,1)*2))}).selected;
  // Las sustitutas conservan las principales primero si una etiqueta no cabe.
  const restCandidates=relevant.filter(c=>!selected.includes(c));
  const reserveMajor=selectSpread(restCandidates.filter(c=>['city','town','village'].includes(c.kind)),{total,max:spares,minMapGap}).selected;
  const {selected:reserve,rest}=selectSpread(restCandidates,{total,max:spares,minMapGap,seeds:reserveMajor});
  return {main:selected,spares:reserve,
    rejected:[...ranked.rejected,...rest.map(c=>brief(c,{reason:c.reason,score:Math.round(c.score)}))]};
}

// Zonas del cartel (1080×1620) ocupadas por paneles. Deben coincidir con drawPoster.
export function posterBlockedRects({showProfile=true,showTips=true}={}){
  return [
    {x:0,y:0,w:284,h:265},{x:270,y:22,w:490,h:160},{x:775,y:22,w:285,h:118},
    {x:30,y:920,w:405,h:255},...(showProfile?[{x:30,y:1195,w:1020,h:236}]:[]),
    ...(showTips?[{x:30,y:1445,w:1020,h:64}]:[]),{x:0,y:1520,w:1080,h:100}
  ];
}

export function orderLocalityLabels(main,spares=[]){
  return [...main].sort((a,b)=>(a.priority??Infinity)-(b.priority??Infinity)).concat(spares);
}

// Coloca etiquetas en píxeles reales: evita paneles y otras etiquetas probando varias
// posiciones alrededor del punto. Lo que no cabe se descarta con su motivo.
export function placeLocalityLabels(candidates,positions,measure,blocked=[],{max=7,maxWidth=290,height=35,maxSecondary=candidates.some(c=>['city','town','village'].includes(c.kind))?2:5}={}){
  const placed=[],dropped=[];
  let secondaryCount=0;
  const hit=(a,b,m=0)=>a.x<b.x+b.w+m&&a.x+a.w+m>b.x&&a.y<b.y+b.h+m&&a.y+a.h+m>b.y;
  for(const c of candidates){
    if(placed.length>=max)break;
    const secondary=c.kind==='hamlet'||c.kind==='unclassified';
    if(secondary&&secondaryCount>=maxSecondary){dropped.push({name:c.name,reason:'limite-secundarias'});continue}
    const p=positions[c.index];
    if(!p){dropped.push({name:c.name,reason:'sin-posicion'});continue}
    if(blocked.some(r=>hit({x:p.x-6,y:p.y-6,w:12,h:12},r))){dropped.push({name:c.name,reason:'bajo-panel'});continue}
    const w=Math.min(maxWidth,measure(c.name)+22);
    // Derecha, izquierda y, si chocan, una fila más arriba y otra más abajo (6 px de separación).
    const above=p.y-29-height-6,below=p.y+12;
    const anchors=[[p.x+14,p.y-29],[p.x-14-w,p.y-29],[p.x+14,above],[p.x-14-w,above],[p.x+14,below],[p.x-14-w,below]];
    const spot=anchors.map(([x,y])=>({x:Math.max(15,Math.min(1065-w,x)),y,w,h:height}))
      .find(r=>r.y>=8&&r.y+r.h<=1452&&!blocked.some(b=>hit(r,b))&&!placed.some(o=>hit(r,o,4)));
    if(!spot){dropped.push({name:c.name,reason:'sin-espacio'});continue}
    placed.push({name:c.name,...spot,dot:{x:p.x,y:p.y}});
    if(secondary)secondaryCount++;
  }
  return {placed,dropped};
}
