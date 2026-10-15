import assert from 'node:assert/strict';
import {GET} from '../api/localities.mjs';
const saved=globalThis.fetch,req=bbox=>new Request('https://example.test/api/localities?'+new URLSearchParams({bbox}));
try{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({elements:[]})};
 for(const bbox of ['',',,,','20,-100,21','20,-100,NaN,-99','21,-100,20,-99','-90,-100,20,-99','20,-190,21,-99','20,-100,24,-99','20,-100,21.5,-98.5'])assert.equal((await GET(req(bbox))).status,400);
 assert.equal(calls,0);
 assert.equal((await GET(new Request(req('22,-100,23,-99'),{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 globalThis.fetch=async(url,options)=>{assert(url.startsWith('https://overpass-'));assert.equal(options.method,'POST');assert.match(options.headers['User-Agent'],/PerrosEnBicicleta/);assert.match(options.body.get('data'),/nwr\["place"/);return Response.json({elements:[{lat:22.5,lon:-99.5,tags:{name:'Pueblo'}},{lat:0,lon:0,tags:{name:'Fuera'}},{lat:null,lon:-99.5,tags:{name:'Mal'}},{lat:22.5,lon:-99.5,tags:{}}]})};
 const response=await GET(req('22,-100,23,-99'));assert.deepEqual((await response.json()).places,[{name:'Pueblo',lat:22.5,lon:-99.5}]);assert.match(response.headers.get('Cache-Control'),/s-maxage/);
 calls=0;globalThis.fetch=async()=>{if(++calls===1)return new Response('',{status:429});return Response.json({elements:[]})};assert.equal((await GET(req('22,-100,23,-99'))).status,200);assert.equal(calls,2);
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await GET(req('22,-100,23,-99'))).status,502);
 calls=0;globalThis.fetch=async()=>{calls++;throw Error('Provider offline')};
 const cached=await GET(req('20.33,-100.42,20.57,-100.18'));const savedPlaces=await cached.json();assert.equal(cached.status,200);assert.equal(savedPlaces.places.length,53);assert(savedPlaces.places.some(p=>p.name==='Huimilpan'));assert.equal(calls,0);
 const subset=await (await GET(req('20.36,-100.30,20.40,-100.25'))).json();assert(subset.places.every(p=>p.lat>=20.36&&p.lat<=20.40&&p.lon>=-100.30&&p.lon<=-100.25));
 const regional=await (await GET(req('20.17,-100.33,20.35,-100.09'))).json();assert.equal(regional.source,'regional-geonames');assert(regional.places.some(p=>p.name==='Amealco de Bonfil'));assert(regional.places.some(p=>p.name==='San Pedro'));assert.equal(calls,0);
 const toliman=await (await GET(req('20.87,-99.95,20.97,-99.88'))).json();assert.equal(toliman.source,'regional-geonames');assert(toliman.places.some(p=>p.name==='Tolimán'));assert.equal(calls,0);
 const dense=await (await GET(req('20.1,-100.49,20.69,-99.81'))).json();assert.equal(dense.source,'regional-geonames');assert(dense.places.length>1000);assert.equal(calls,0);
 calls=0;globalThis.fetch=async()=>{calls++;return calls===1?Response.json({elements:[],remark:'runtime error: Query timed out'}):Response.json({elements:[{type:'way',center:{lat:22.5,lon:-99.5},tags:{name:'Localidad como área'}}]})};
 const area=await (await GET(req('22,-100,23,-99'))).json();assert.equal(calls,2);assert.deepEqual(area.places,[{name:'Localidad como área',lat:22.5,lon:-99.5}]);
 console.log('PASS: validación de área, límite de consulta, datos OSM válidos, caché, proveedor alternativo y fallos.');
}finally{globalThis.fetch=saved}
