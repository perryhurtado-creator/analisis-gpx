import assert from 'node:assert/strict';
import {POST} from '../api/route.mjs';
const originalFetch=globalThis.fetch,originalKey=process.env.ORS_API_KEY;
const request=coordinates=>new Request('https://example.test/api/route',{method:'POST',body:JSON.stringify({coordinates})});
let count=0;
try{
 for(const invalid of [[],[[0,0]],[[0,0],[181,0]],[[0,0],[0,91]],[[0,0],[0,0]],[[null,0],[1,1]],Array.from({length:51},(_,i)=>[i,0])]){assert.equal((await POST(request(invalid))).status,400);count++}
 delete process.env.ORS_API_KEY;assert.equal((await POST(request([[0,0],[1,1]]))).status,503);count++;
 process.env.ORS_API_KEY='test-secret';
 globalThis.fetch=async(url,options)=>{
  assert.equal(options.headers.Authorization,'test-secret');const body=JSON.parse(options.body);
  if(url.endsWith('/elevation/line')){assert.equal(body.format_in,'geojson');assert.ok(body.geometry.coordinates.length<=2000);return Response.json({geometry:{type:'LineString',coordinates:body.geometry.coordinates.map((c,i,cs)=>[...c,1800+i*40/(cs.length-1)])}})}
  assert.equal(url,'https://api.openrouteservice.org/v2/directions/cycling-mountain/geojson');assert.equal(body.elevation,false);assert.deepEqual(body.coordinates,[[-100.4,20.5],[-100.3,20.6]]);
  return Response.json({features:[{geometry:{type:'LineString',coordinates:[[-100.4,20.5,0],[-100.3,20.6,0]]},properties:{ascent:99999,descent:99999,summary:{distance:15000,duration:3600}}}]});
 };
 const result=await POST(request([[-100.4,20.5],[-100.3,20.6]]));assert.equal(result.status,200);const data=await result.json();assert.equal(data.distance,15000);assert.equal(data.elevation.ascent,40);assert.equal(data.elevation.descent,0);assert.equal(data.elevation.min,1800);assert.equal(data.elevation.max,1840);assert.equal(data.elevation.complete,true);assert.match(data.elevation.source,/SRTM/);assert.ok(!JSON.stringify(data).includes('test-secret'));count++;
 for(const [code,expected] of [[400,422],[429,429],[403,503],[500,502]]){globalThis.fetch=async()=>new Response('',{status:code});assert.equal((await POST(request([[0,0],[1,1]]))).status,expected);count++}
 globalThis.fetch=async()=>Response.json({features:[]});assert.equal((await POST(request([[0,0],[1,1]]))).status,502);count++;
 globalThis.fetch=async()=>{throw new DOMException('timeout','TimeoutError')};assert.equal((await POST(request([[0,0],[1,1]]))).status,502);count++;
 globalThis.fetch=async(url,options)=>{const body=JSON.parse(options.body);if(url.endsWith('/elevation/line'))return Response.json({geometry:{type:'LineString',coordinates:body.geometry.coordinates.map(c=>[...c,100])}});assert.equal(body.coordinates.length,3);assert.deepEqual(body.radiuses,[200,200,200]);return Response.json({features:[{geometry:{type:'LineString',coordinates:body.coordinates},properties:{summary:{distance:2000,duration:400}}}]})};
 assert.equal((await POST(request([[0,0],[1,1],[2,2]]))).status,200);count++;
 assert.equal((await POST(request([[0,0],[1,1],[1,1]]))).status,400);count++;
 assert.equal((await POST(new Request('https://example.test/api/route',{method:'POST',body:'null'}))).status,400);count++;
 globalThis.fetch=async(url)=>url.endsWith('/elevation/line')?new Response('',{status:429}):Response.json({features:[{geometry:{type:'LineString',coordinates:[[0,0],[0.001,0.001]]},properties:{summary:{distance:100,duration:20}}}]});
 const failedTerrain=await (await POST(request([[0,0],[0.001,0.001]]))).json();assert.equal(failedTerrain.elevation.ascent,null);assert.ok(failedTerrain.elevation.message);assert.ok(failedTerrain.geometry.coordinates.every(c=>c.length===2));count++;
 console.log(`${count} route API checks passed`);
}finally{globalThis.fetch=originalFetch;if(originalKey===undefined)delete process.env.ORS_API_KEY;else process.env.ORS_API_KEY=originalKey}
