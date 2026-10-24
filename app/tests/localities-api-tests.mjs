import assert from 'node:assert/strict';
import {GET} from '../api/localities.mjs';
const saved=globalThis.fetch,req=bbox=>new Request('https://example.test/api/localities?'+new URLSearchParams({bbox}));
try{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({elements:[]})};
 for(const bbox of ['',',,,','20,-100,21','20,-100,NaN,-99','21,-100,20,-99','-90,-100,20,-99','20,-190,21,-99','20,-100,24,-99','20,-100,21.5,-98.5'])assert.equal((await GET(req(bbox))).status,400);
 assert.equal(calls,0);
 assert.equal((await GET(new Request(req('22,-100,23,-99'),{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 globalThis.fetch=async(url,options)=>{assert(url.startsWith('https://overpass-'));assert.equal(options.method,'POST');assert.match(options.headers['User-Agent'],/PerrosEnBicicleta/);assert.match(options.body.get('data'),/nwr\["place"/);return Response.json({elements:[{lat:22.5,lon:-99.5,tags:{name:'Pueblo',place:'village',population:'900'}},{lat:0,lon:0,tags:{name:'Fuera'}},{lat:null,lon:-99.5,tags:{name:'Mal'}},{lat:22.5,lon:-99.5,tags:{}}]})};
 const response=await GET(req('22,-100,23,-99'));assert.deepEqual((await response.json()).places,[{name:'Pueblo',lat:22.5,lon:-99.5,place:'village',population:'900'}]);assert.match(response.headers.get('Cache-Control'),/s-maxage/);
 calls=0;globalThis.fetch=async()=>{if(++calls===1)return new Response('',{status:429});return Response.json({elements:[]})};assert.equal((await GET(req('22,-100,23,-99'))).status,200);assert.equal(calls,2);
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await GET(req('22,-100,23,-99'))).status,502);
 calls=0;globalThis.fetch=async()=>{calls++;throw Error('Provider offline')};
 const cached=await GET(req('20.33,-100.42,20.57,-100.18'));const savedPlaces=await cached.json();assert.equal(cached.status,200);assert(savedPlaces.places.length>=53);assert.equal(savedPlaces.source,'partial-catalogue');assert.equal(savedPlaces.partial,true);assert.equal(cached.headers.get('Cache-Control'),'no-store');assert(savedPlaces.places.some(p=>p.name==='Huimilpan'));assert(calls>0,'el catálogo no sustituye la consulta de categorías OSM');
 const subset=await (await GET(req('20.36,-100.30,20.40,-100.25'))).json();assert(subset.places.every(p=>p.lat>=20.36&&p.lat<=20.40&&p.lon>=-100.30&&p.lon<=-100.25));
 const regional=await (await GET(req('20.17,-100.33,20.35,-100.09'))).json();assert.equal(regional.source,'partial-catalogue');assert(regional.places.some(p=>p.name==='Amealco de Bonfil'));assert(regional.places.some(p=>p.name==='San Pedro'));assert(calls>0,'el catálogo no sustituye la consulta de categorías OSM');
 const toliman=await (await GET(req('20.87,-99.95,20.97,-99.88'))).json();assert.equal(toliman.source,'partial-catalogue');assert(toliman.places.some(p=>p.name==='Tolimán'));assert(calls>0,'el catálogo no sustituye la consulta de categorías OSM');
 const dense=await (await GET(req('20.1,-100.49,20.69,-99.81'))).json();assert.equal(dense.source,'partial-catalogue');assert(dense.places.length>1000);assert(calls>0,'el catálogo no sustituye la consulta de categorías OSM');
 calls=0;globalThis.fetch=async()=>{calls++;return calls===1?Response.json({elements:[],remark:'runtime error: Query timed out'}):Response.json({elements:[{type:'way',center:{lat:22.5,lon:-99.5},tags:{name:'Localidad como área'}}]})};
 const area=await (await GET(req('22,-100,23,-99'))).json();assert.equal(calls,2);assert.deepEqual(area.places,[{name:'Localidad como área',lat:22.5,lon:-99.5}]);
 // Categoría y población viajan al cliente; el caserío sin población se conserva; consulta separada por nivel.
 globalThis.fetch=async(url,options)=>{const q=options.body.get('data');assert.match(q,/city\|town\|village/);assert.match(q,/"hamlet"/);return Response.json({elements:[{type:'node',lat:22.5,lon:-99.5,tags:{name:'Caserío',place:'hamlet'}},{type:'node',lat:22.6,lon:-99.4,tags:{name:'Ciudad',place:'city',population:'120000'}}]})};
 const cats=await (await GET(req('22,-100,23,-99'))).json();assert.deepEqual(cats.places.map(p=>[p.name,p.place,p.population??null]),[['Caserío','hamlet',null],['Ciudad','city','120000']]);assert(!('truncated' in cats));
 // Respuesta que llega al tope: se marca truncada y la caché pública baja de 24 h a 1 h.
 globalThis.fetch=async()=>Response.json({elements:Array.from({length:500},(_,i)=>({type:'node',lat:22.1+i*1e-4,lon:-99.5,tags:{name:'Pueblo '+i,place:'village'}}))});
 const full=await GET(req('22,-100,23,-99'));assert.equal((await full.json()).truncated,true);assert.equal(full.headers.get('Cache-Control'),'public, s-maxage=3600');
 // Mismo lugar en catálogo y OSM: una sola entrada y se conserva la categoría OSM.
 globalThis.fetch=async()=>Response.json({elements:[{type:'node',lat:20.374612,lon:-100.2754284,tags:{name:'Huimilpan',place:'town',population:'5000'}}]});
 const huimilpan=(await (await GET(req('20.36,-100.30,20.40,-100.25'))).json()).places.filter(p=>p.name==='Huimilpan');assert(huimilpan.some(p=>p.place==='town'&&p.population==='5000'),'la categoría OSM llega al cliente');
 const {mergePlaces}=await import('../js/locality-selection.js');const one=mergePlaces(huimilpan);assert.equal(one.length,1,'el cliente une las fuentes (~300 m)');assert.equal(one[0].place,'town');
 // Un fallo de proveedor no queda en caché pública.
 globalThis.fetch=async()=>{throw Error('offline')};assert.equal((await GET(req('22,-100,23,-99'))).headers.get('Cache-Control'),'no-store');
 console.log('PASS: validación de área, límite de consulta, datos OSM válidos, caché, proveedor alternativo y fallos.');
}finally{globalThis.fetch=saved}
