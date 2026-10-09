import assert from 'node:assert/strict';
import {GET} from '../api/places.mjs';
const savedFetch=globalThis.fetch,savedKey=process.env.ORS_API_KEY;
const request=q=>new Request('https://example.test/api/places?'+new URLSearchParams({q,lat:'20.5',lon:'-100.4'}));
try{
 for(const q of ['', 'ab', 'x'.repeat(161)])assert.equal((await GET(request(q))).status,400);
 delete process.env.ORS_API_KEY;assert.equal((await GET(request('Querétaro'))).status,503);process.env.ORS_API_KEY='test-secret';
 globalThis.fetch=async url=>{assert.equal(url.origin,'https://api.openrouteservice.org');assert.equal(url.searchParams.get('api_key'),'test-secret');assert.equal(url.searchParams.get('text'),'Querétaro');assert.equal(url.searchParams.get('focus.point.lon'),'-100.4');return Response.json({features:[{geometry:{type:'Point',coordinates:[-100.4,20.5]},properties:{label:'Querétaro, México'}},{geometry:{type:'Point',coordinates:[null,20]},properties:{label:'Bad'}},{geometry:{type:'Point',coordinates:[181,20]},properties:{label:'Bad'}}]})};
 const result=await GET(request('Querétaro')),data=await result.json();assert.equal(result.status,200);assert.deepEqual(data.places,[{label:'Querétaro, México',lon:-100.4,lat:20.5}]);assert.ok(!JSON.stringify(data).includes('test-secret'));assert.match(result.headers.get('Cache-Control'),/s-maxage/);
 globalThis.fetch=async()=>Response.json({features:[]});assert.deepEqual((await (await GET(request('Unknown'))).json()).places,[]);
 for(const [code,expected] of [[403,502],[429,429],[500,502]]){globalThis.fetch=async()=>new Response('',{status:code});assert.equal((await GET(request('Querétaro'))).status,expected)}
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await GET(request('Querétaro'))).status,502);
 console.log('Place API checks passed: validation, missing key, query encoding/bias, coordinates, safe response, caching, empty results, provider failures, timeout');
}finally{globalThis.fetch=savedFetch;if(savedKey===undefined)delete process.env.ORS_API_KEY;else process.env.ORS_API_KEY=savedKey}
