import assert from 'node:assert/strict';
import {GET} from '../api/localities.mjs';
const saved=globalThis.fetch,req=bbox=>new Request('https://example.test/api/localities?'+new URLSearchParams({bbox}));
try{
 let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({elements:[]})};
 for(const bbox of ['',',,,','20,-100,21','20,-100,NaN,-99','21,-100,20,-99','-90,-100,20,-99','20,-190,21,-99','20,-100,24,-99','20,-100,21.5,-98.5'])assert.equal((await GET(req(bbox))).status,400);
 assert.equal(calls,0);
 assert.equal((await GET(new Request(req('20,-100,21,-99'),{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 globalThis.fetch=async(url,options)=>{assert(url.startsWith('https://overpass-'));assert.equal(options.method,'POST');assert.match(options.headers['User-Agent'],/PerrosEnBicicleta/);assert.match(options.body.get('data'),/node\["place"/);return Response.json({elements:[{lat:20.5,lon:-99.5,tags:{name:'Pueblo'}},{lat:0,lon:0,tags:{name:'Fuera'}},{lat:null,lon:-99.5,tags:{name:'Mal'}},{lat:20.5,lon:-99.5,tags:{}}]})};
 const response=await GET(req('20,-100,21,-99'));assert.deepEqual((await response.json()).places,[{name:'Pueblo',lat:20.5,lon:-99.5}]);assert.match(response.headers.get('Cache-Control'),/s-maxage/);
 calls=0;globalThis.fetch=async()=>{if(++calls===1)return new Response('',{status:429});return Response.json({elements:[]})};assert.equal((await GET(req('20,-100,21,-99'))).status,200);assert.equal(calls,2);
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await GET(req('20,-100,21,-99'))).status,502);
 console.log('PASS: validación de área, límite de consulta, datos OSM válidos, caché, proveedor alternativo y fallos.');
}finally{globalThis.fetch=saved}
