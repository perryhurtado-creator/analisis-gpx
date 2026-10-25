import assert from 'node:assert/strict';
import {classifyPlace,mergePlaces,rankLocalities,selectPosterLocalities,placeLocalityLabels,posterBlockedRects,populationOf,normalizeName,PLACE_CLASSES} from '../js/locality-selection.js';
import {localitiesAlongRoute} from '../js/video-localities.js';
import {posterLocalities} from '../js/poster-localities.js';
import {regionalLocalities} from '../js/catalogues/localities-regional.mjs';
import {cachedLocalities} from '../js/catalogues/localities-cache.mjs';

const M=111320,signal=new AbortController().signal;
// Ruta sintética: cada argumento es un tramo (lista de extremos [lat,lon]). Los cortes entre tramos no suman distancia.
function makeRoute(...segments){
  const points=[];let d=0;
  segments.forEach((ends,segmentId)=>{
    let prev=null;
    for(let k=0;k<ends.length-1;k++){
      const [lat1,lon1]=ends[k],[lat2,lon2]=ends[k+1];
      const length=Math.hypot((lon2-lon1)*M*Math.cos(lat1*Math.PI/180),(lat2-lat1)*M),steps=Math.max(1,Math.round(length/100));
      for(let i=k?1:0;i<=steps;i++){
        const p={lat:lat1+(lat2-lat1)*i/steps,lon:lon1+(lon2-lon1)*i/steps,segmentId,breakBefore:!prev};
        if(prev)d+=Math.hypot((p.lon-prev.lon)*M*Math.cos(p.lat*Math.PI/180),(p.lat-prev.lat)*M);
        p.d=d;points.push(p);prev=p;
      }
    }
  });
  return points;
}
const north=(lat,metres)=>lat+metres/M;
const east=makeRoute([[20,-100],[20,-99.8]]);            // ~21 km hacia el este
const mid=-99.9;
const names=list=>list.map(p=>p.name);

// 1. Clases de lugar × distancia al recorrido (100, 500, 900 y 1 500 m). Radios documentados en PLACE_CLASSES.
const samples={city:{name:'Ciudad Prueba',place:'city'},town:{name:'Pueblo Prueba',place:'town'},village:{name:'Comunidad Prueba',place:'village'},hamlet:{name:'Caserío Prueba',place:'hamlet'},unclassified:{name:'Lugar Prueba'}};
const radii={city:3000,town:2500,village:1500,hamlet:900,unclassified:600};
for(const [kind,base] of Object.entries(samples)){
  assert.equal(PLACE_CLASSES[kind].radius,radii[kind]);
  for(const offset of [100,500,900,1500]){
    const {accepted}=rankLocalities(east,[{...base,lat:north(20,offset),lon:mid}]);
    assert.equal(accepted.length,offset<=radii[kind]?1:0,`${kind} a ${offset} m`);
    if(accepted.length)assert(Math.abs(accepted[0].offset-offset)<2,'la distancia es al trazado real');
  }
}
console.log('PASS clases city/town/village/hamlet/sin categoría a 100, 500, 900 y 1 500 m con su radio.');

// 2. Importancia: ciudad > pueblo > comunidad > caserío sin población; la población suma; formatos de población.
const ranked=rankLocalities(east,Object.values(samples).slice(0,4).map((p,i)=>({...p,lat:north(20,100),lon:-99.97+i*.02}))).accepted;
const byName=Object.fromEntries(ranked.map(p=>[p.name,p.score]));
assert(byName['Ciudad Prueba']>byName['Pueblo Prueba']&&byName['Pueblo Prueba']>byName['Comunidad Prueba']&&byName['Comunidad Prueba']>byName['Caserío Prueba']);
assert.equal(ranked.find(p=>p.name==='Caserío Prueba').kind,'hamlet','un caserío sin población registrada ya no se descarta');
const hamlets=rankLocalities(east,[{name:'Con Población',place:'hamlet',population:'1,200',lat:north(20,100),lon:-99.95},{name:'Sin Población',place:'hamlet',lat:north(20,100),lon:-99.85}]).accepted;
assert(hamlets.find(p=>p.name==='Con Población').score>hamlets.find(p=>p.name==='Sin Población').score);
assert.deepEqual(['1,200','1 200','1.200',1200,'1200'].map(populationOf),[1200,1200,1200,1200,1200]);assert.equal(populationOf('muchos'),0);assert.equal(populationOf(null),0);
console.log('PASS importancia geográfica, caserío sin población y lectura de población.');

// 3. Falsos positivos: establecimientos, propiedades, viviendas aisladas y subdivisiones.
const excluded=[
  [{name:'Rancho La Esperanza'},'nombre-de-establecimiento'],[{name:'Familia Pérez Núñez'},'nombre-de-establecimiento'],
  [{name:'Fraccionamiento Los Pinos'},'nombre-de-establecimiento'],[{name:'Ex-Hacienda de Ocotza'},'nombre-de-establecimiento'],
  [{name:'Hotel Vista Hermosa'},'nombre-de-establecimiento'],[{name:'Gasolinera Km 5'},'nombre-de-establecimiento'],
  [{name:'Centro de Readaptación Social'},'nombre-de-establecimiento'],[{name:'La Perita [Fraccionamiento]'},'nombre-de-establecimiento'],
  [{name:'Barrio la Mesa'},'subdivision-urbana'],[{name:'Primera Manzana Dosdha'},'subdivision-urbana'],
  [{name:'Casa de Juan',place:'isolated_dwelling'},'categoria-no-admitida'],[{name:'Mesa Alta',place:'locality'},'categoria-no-admitida'],
  [{name:'Centro',place:'suburb'},'subdivision-urbana'],[{name:''},'sin-nombre']
];
for(const [place,reason] of excluded)assert.deepEqual(classifyPlace(place),{excluded:true,reason},JSON.stringify(place));
// La categoría OSM manda: un pueblo llamado "Rancho Nuevo" o con alias entre paréntesis es una localidad real.
assert.equal(classifyPlace({name:'Rancho Nuevo',place:'village'}).kind,'village');
assert.equal(classifyPlace({name:'General Lázaro Cárdenas (El Colorado)'}).kind,'unclassified');
assert.equal(classifyPlace({name:'Santa Genoveva (Rancho Miranda)'}).kind,'unclassified','el alias no cuenta como nombre');
assert.equal(classifyPlace({name:'Pañhé'}).kind,'unclassified');
const mixed=rankLocalities(east,[...excluded.map(([p],i)=>({...p,lat:north(20,100),lon:-99.99+i*.001})),{name:'Pañhé',lat:north(20,100),lon:-99.86}]);
assert.deepEqual(names(mixed.accepted),['Pañhé']);assert.equal(mixed.rejected.filter(r=>r.reason).length>=excluded.length-1,true);
console.log('PASS exclusión de establecimientos, familias, viviendas aisladas, subdivisiones y nombres vacíos.');

// 4. Mismo nombre, distintas coordenadas: son localidades distintas; mismo lugar en dos fuentes se une conservando la categoría OSM.
const sanPedroA={name:'San Pedro',place:'village',lat:north(20,100),lon:-99.95},sanPedroB={name:'San Pedro',place:'village',lat:north(20,100),lon:-99.85};
assert.deepEqual(names(selectPosterLocalities(east,[sanPedroA,sanPedroB]).main),['San Pedro','San Pedro']);
const catalogueEntry={name:'San Pedro',lat:north(20,300),lon:-99.95},osmEntry={name:'San Pedro',place:'village',population:'800',lat:north(20,100),lon:-99.9503};
for(const order of [[catalogueEntry,osmEntry],[osmEntry,catalogueEntry]]){
  const merged=mergePlaces(order);assert.equal(merged.length,1);assert.equal(merged[0].place,'village','la categoría OSM no se pierde por el orden');assert.equal(merged[0].lat,osmEntry.lat);assert.equal(populationOf(merged[0].population),800);
}
assert.equal(mergePlaces([{name:'El Rosario',lat:20,lon:-99.9},{name:'El Rosario',lat:north(20,3000),lon:-99.9}]).length,2);
assert.equal(mergePlaces([{name:'Pañhé',lat:20,lon:-99.9},{name:'PAÑHE',lat:north(20,200),lon:-99.9}]).length,1,'mayúsculas y acentos no crean duplicados');
// Uno lejos de la ruta no tapa al que sí está en ella.
assert.deepEqual(names(selectPosterLocalities(east,[sanPedroA,{...sanPedroB,lat:north(20,20000)}]).main),['San Pedro']);
console.log('PASS mismo nombre con coordenadas distintas, unión de fuentes y categoría preservada.');

// 5. Rutas con tramos separados: la proximidad se mide contra los tramos, nunca contra el hueco.
const split=makeRoute([[20,-100],[20,-99.95]],[[20,-99.75],[20,-99.7]]);
assert(split[0].breakBefore&&split.some((p,i)=>i&&p.breakBefore&&p.segmentId===1));
const inGap={name:'En el hueco',place:'village',lat:north(20,50),lon:-99.85};
const nearA={name:'Junto al tramo A',place:'village',lat:north(20,200),lon:-99.975},nearB={name:'Junto al tramo B',place:'village',lat:north(20,200),lon:-99.725};
const splitRanked=rankLocalities(split,[inGap,nearA,nearB]).accepted;
assert.deepEqual(names(splitRanked).sort(),['Junto al tramo A','Junto al tramo B']);
const [a,b]=['Junto al tramo A','Junto al tramo B'].map(n=>splitRanked.find(p=>p.name===n));
assert(b.distance>a.distance&&b.distance-a.distance<8000,'el hueco entre tramos no suma distancia');
console.log('PASS tramos separados: el hueco no genera localidades y la distancia acumulada no salta.');

// 6. Fuera de Querétaro. a) Hidalgo con datos reales del catálogo (ruta sintética entre dos puntos reales).
const hidalgo=makeRoute([[20.52167,-99.69667],[20.61,-99.63972]]);
let calls=0;const offline=await posterLocalities(hidalgo,signal,{fetcher:async()=>{calls++;throw Error('No debe llamarse')}});
assert.equal(calls,0,'sin ampliar la búsqueda no sale nada a la red');
assert(names(offline.places).includes('Pañhé')&&names(offline.places).includes('Xidhí'),'las dos comunidades extremo aparecen');
assert(offline.places.every(p=>Number.isInteger(p.index)&&p.index<hidalgo.length)&&offline.places.length<=7);
assert(!offline.places.some(p=>/^(barrio|rancho|familia)/i.test(p.name)),'sin barrios, ranchos ni familias');
// b) Yucatán: sin catálogo local. Sin búsqueda en línea no hay datos; con ella, se seleccionan por categoría y cercanía.
const yucatan=makeRoute([[20.9,-89.62],[20.95,-89.55]]);
const none=await posterLocalities(yucatan,signal,{fetcher:async()=>{calls++}});assert.deepEqual(none.places,[]);assert.match(none.message,/No se encontraron/);assert.equal(calls,0);
const osm=[
  {name:'Pueblo Prueba',lat:20.9,lon:-89.62,place:'village',population:'900'},{name:'Caserío Prueba',lat:20.935,lon:-89.581,place:'hamlet'},
  {name:'Casa Aislada',lat:20.925,lon:-89.6,place:'isolated_dwelling'},{name:'Pueblo Lejano',lat:21.4,lon:-89.0,place:'village'}
].map(p=>({...p,lat:p.lat+.0009}));
const online=await posterLocalities(yucatan,signal,{external:true,fetcher:async url=>{calls++;assert(url.startsWith('/api/localities?bbox='));return Response.json({places:osm})}});
assert.equal(calls,1);assert.deepEqual(names(online.places).sort(),['Caserío Prueba','Pueblo Prueba']);
console.log('PASS rutas fuera de Querétaro: Hidalgo con datos reales del catálogo y Yucatán con consulta explícita.');

// 7. Respuesta vacía o fallo de Overpass/servidor: nunca rompe y conserva el catálogo.
const failures={
  vacía:async()=>Response.json({places:[]}),http503:async()=>Response.json({},{status:503}),red:async()=>{throw new TypeError('fetch failed')},
  jsonInválido:async()=>new Response('<html>no es json</html>',{status:200}),sinLista:async()=>Response.json({error:'x'})
};
// La caché por área devuelve la respuesta anterior si el área se repite (esperado), así que cada caso
// usa un área distinta —la ruta de Hidalgo con una cola al norte— y se comprueba que el fetcher sí corrió.
const variant=i=>makeRoute([[20.52167,-99.69667],[20.61,-99.63972],[20.61+.02*(i+1),-99.63972]]);
let variantIndex=0;
for(const [label,fetcher] of Object.entries(failures)){
  let ran=0;
  const result=await posterLocalities(variant(variantIndex++),signal,{external:true,fetcher:async(...args)=>{ran++;return fetcher(...args)}});
  // Cualquier fallo se reintenta una vez; una respuesta válida (aunque vacía) no.
  assert.equal(ran,label==='vacía'?1:2,`intentos de "${label}"`);
  assert(names(result.places).includes('Pañhé'),`catálogo conservado con respuesta ${label}`);
  if(label==='vacía')assert.match(result.message,/consulta por área/);else assert.match(result.message,/No se pudo ampliar la búsqueda/);
}
let ranOutside=0;
const failedOutside=await posterLocalities(makeRoute([[21.9,-89.62],[21.95,-89.55]]),signal,{external:true,fetcher:async()=>{ranOutside++;throw new TypeError('fetch failed')}});
assert.equal(ranOutside,2,'reintento único ante fallo de red');assert.deepEqual(failedOutside.places,[]);assert.match(failedOutside.message,/No se encontraron/);
const aborter=new AbortController();let abortRan=0;
await assert.rejects(posterLocalities(variant(variantIndex++),aborter.signal,{external:true,fetcher:async()=>{abortRan++;aborter.abort();throw new DOMException('x','AbortError')}}),{name:'AbortError'});assert.equal(abortRan,1);
console.log('PASS respuesta vacía, HTTP 503, red caída, JSON inválido y cancelación.');

// 8. Catálogos densos: ya no se pierde el final de la ruta por el tope de 160 en orden de recorrido.
const long=makeRoute([[20,-100],[20,-99.45]]);
const hamletsAlong=Array.from({length:400},(_,i)=>({name:'Aldea '+i,place:'hamlet',lat:north(20,200),lon:-100+i*.00125}));
const finalVillage={name:'Pueblo Final',place:'village',lat:north(20,100),lon:-99.46};
const dense=[...hamletsAlong,finalVillage];
const legacy=localitiesAlongRoute(long,dense,900);
assert.equal(legacy.length,160);assert(!names(legacy).includes('Pueblo Final'),'el tope histórico recortaba el final de la ruta');
assert(rankLocalities(long,dense).accepted.length>=401,'ahora se puntúan todos');
assert(names(selectPosterLocalities(long,dense).main).includes('Pueblo Final'));
console.log('PASS catálogo denso: el pueblo del final de una ruta larga sobrevive (el tope anterior lo eliminaba).');

// 9. Reparto a lo largo de la ruta con importancia igual.
const evenly=Array.from({length:30},(_,i)=>({name:'Comunidad '+i,place:'village',lat:north(20,100),lon:-99.995+i*.0165}));
const picked=selectPosterLocalities(long,evenly).main,third=long.at(-1).d/3;
assert.equal(picked.length,7);
for(let k=0;k<3;k++)assert(picked.some(p=>p.distance>=k*third&&p.distance<=(k+1)*third),'cada tercio de la ruta tiene al menos una etiqueta');
assert.deepEqual(selectPosterLocalities(long,evenly).main,picked,'determinista');
console.log('PASS reparto espacial y resultado determinista.');

// 10. Colocación de etiquetas en píxeles reales (antes: bandas fijas y 60 px vertical contra la anterior).
const measure=text=>text.length*10;
const overlap=(p,q,m=0)=>p.x<q.x+q.w+m&&p.x+p.w+m>q.x&&p.y<q.y+q.h+m&&p.y+p.h+m>q.y;
const panels=posterBlockedRects({showProfile:true,showTips:true}),panelsNoProfile=posterBlockedRects({showProfile:false,showTips:false});
let r=placeLocalityLabels([{name:'Bajo el título',index:0},{name:'Libre',index:1},{name:'Arriba a la derecha',index:2}],[{x:400,y:100},{x:600,y:600},{x:900,y:200}],measure,panels);
assert.deepEqual(r.dropped,[{name:'Bajo el título',reason:'bajo-panel'}]);assert.deepEqual(names(r.placed),['Libre','Arriba a la derecha'],'y<255 sin panel ya no se descarta');
const crowd=Array.from({length:6},(_,i)=>({name:'Etiqueta '+i,index:0}));
r=placeLocalityLabels(crowd,[{x:540,y:700}],measure,panels,{max:7});
assert(r.placed.length>=4);
for(const [i,p] of r.placed.entries()){assert(!panels.some(b=>overlap(p,b)));for(const q of r.placed.slice(i+1))assert(!overlap(p,q),'sin solapes entre etiquetas')}
assert.equal(placeLocalityLabels(Array.from({length:10},(_,i)=>({name:'N'+i,index:i})),Array.from({length:10},(_,i)=>({x:100+i*90,y:400+(i%2)*200})),measure,panels).placed.length,7);
const low=[{name:'Zona baja',index:0}],lowPos=[{x:700,y:1300}];
assert.equal(placeLocalityLabels(low,lowPos,measure,panelsNoProfile).placed.length,1,'sin perfil, y>1130 es una zona libre');
assert.deepEqual(placeLocalityLabels(low,lowPos,measure,panels).dropped,[{name:'Zona baja',reason:'bajo-panel'}],'con perfil, ese punto sí queda tapado');
for(const p of placeLocalityLabels(low,[{x:1075,y:600}],measure,panels).placed)assert(p.x>=15&&p.x+p.w<=1065);
console.log('PASS etiquetas: paneles, solapes, sustitutas de posición, máximo de 7 y límites del lienzo.');

// 11. Regresión "La Magnífica": la lista manual antigua (ya eliminada) sigue siendo elegible sin necesidad de lista.
const LEGACY=['santiago de querétaro','querétaro','huimilpan','escolásticas','palos altos','san pedro','san pedro tenango','san pedro huimilpan','ajuchitlancito','la venta de ajuchitlancito','dolores de ajuchitlancito','lagunillas','el vegil','el rosario','san cirilo','san fandila','san isidro miranda','san pedro mártir','santa teresa','san rafael','las taponas','apapátaro','san francisco nevería','la ceja','san josé tepuzas','el salitrillo','calamanda','palo alto','san antonio la galera','general lázaro cárdenas (el colorado)','el colorado','el pueblito','corregidora','amealco de bonfil','amealco','san juan del río','pedro escobedo','colón','tolimán','tequisquiapan','ezequiel montes','bernal','juriquilla'].map(normalizeName);
const catalogue=[...(cachedLocalities([20.33,-100.42,20.57,-100.18])||[]),...(regionalLocalities([20,-100.5,21.7,-99])||[])];
const legacyHits=catalogue.filter(p=>LEGACY.includes(normalizeName(p.name)));
assert(legacyHits.length>=100,'datos del catálogo presentes');
assert.deepEqual(legacyHits.filter(p=>classifyPlace(p).excluded).map(p=>p.name),[],'ningún nombre de la lista antigua queda excluido');
// Y con categoría OSM, los de más rango (ciudades, pueblos) no necesitan el catálogo.
assert.equal(classifyPlace({name:'Amealco de Bonfil',place:'town'}).kind,'town');
console.log(`PASS regresión: ${legacyHits.length} entradas del catálogo que la lista antigua aceptaba siguen siendo elegibles.`);

// 12. Calidad del catálogo regional: lo que nunca debe llegar al cartel sin categoría OSM.
const admitted=regionalLocalities([20,-100.5,21.7,-99]).filter(p=>!classifyPlace(p).excluded).map(p=>normalizeName(p.name));
assert(admitted.length>6000);assert(!admitted.some(n=>/^(familia|rancho|fraccionamiento|colonia|barrio|hacienda|ex-hacienda)\b/.test(n)));
console.log(`PASS catálogo regional: ${admitted.length} entradas admitidas y ninguna "Familia/Rancho/Fraccionamiento/Colonia/Barrio/Hacienda".`);

// 13. Rendimiento: una ruta larga con miles de puntos y un catálogo denso termina en tiempo razonable.
const big=makeRoute([[20.2,-100.45],[20.6,-100.1],[20.9,-99.8]]);
const bigPoints=Array.from({length:20000},(_,i)=>big[Math.floor(i*(big.length-1)/19999)]);
const started=performance.now(),result=selectPosterLocalities(bigPoints,catalogue);const elapsed=performance.now()-started;
assert(result.main.length>0&&elapsed<5000,`tardó ${Math.round(elapsed)} ms`);
console.log(`PASS rendimiento: 20 000 puntos × ${catalogue.length} lugares en ${Math.round(elapsed)} ms.`);

// IA-02 equilibrado: endpoints, tier priority, gap filling, short routes and loops.
const start={name:'Origen',place:'village',lat:20,lon:-100};
const finish={name:'Destino',place:'village',lat:20,lon:-99.45};
const cities=Array.from({length:10},(_,i)=>({name:'Ciudad '+i,place:'city',lat:20,lon:-99.96+i*.045}));
const endpoints=selectPosterLocalities(long,[...cities,start,finish]).main;
assert(names(endpoints).includes('Origen')&&names(endpoints).includes('Destino'));
const villages=Array.from({length:9},(_,i)=>({name:'Principal '+i,place:'village',lat:north(20,1400),lon:-100+i*.06875}));
const wealthyHamlets=hamletsAlong.map(p=>({...p,population:999999}));
assert(selectPosterLocalities(long,[...villages,...wealthyHamlets]).main.every(p=>p.kind==='village'));
const gapFill=selectPosterLocalities(long,[start,finish,{name:'Intermedio',place:'hamlet',lat:20,lon:-99.725}]).main;
assert(names(gapFill).includes('Intermedio'));
const clustered=selectPosterLocalities(long,[start,finish,{name:'Junto al origen',place:'hamlet',lat:20,lon:-99.997}]).main;
assert(!names(clustered).includes('Junto al origen'));
const short=makeRoute([[20,-100],[20,-99.99]]);
assert.equal(selectPosterLocalities(short,[start,{name:'Final corto',place:'village',lat:20,lon:-99.99}]).main.length,2);
const loop=makeRoute([[20,-100],[20,-99.9],[20,-100]]);
assert.equal(names(selectPosterLocalities(loop,[start]).main).filter(n=>n==='Origen').length,1);
assert.deepEqual(classifyPlace({name:'Granja Avícola',place:'hamlet'}),{excluded:true,reason:'nombre-de-establecimiento'});
assert.equal(classifyPlace({name:'Pueblo',place:'unclassified'}).kind,'unclassified');
assert.deepEqual(selectPosterLocalities([],[]).main,[]);
console.log('PASS IA-02 equilibrado: extremos, principales antes de caseríos, huecos, ruta corta y circuito.');
