import assert from 'node:assert/strict';
import {validateActivityFile,validateActivityXML,MAX_FILE_BYTES,MAX_TRACK_POINTS} from '../js/activity-limits.js';
import {createActivityReader} from '../js/activity-reader.js';
import {boundedJSON} from '../api/safety.mjs';
import {POST} from '../api/route.mjs';
import {slopeStats,speedStats} from '../js/metrics.js';

for(const file of [{name:'bad.html',size:1},{name:'empty.gpx',size:0},{name:'large.tcx',size:MAX_FILE_BYTES+1}])assert.throws(()=>validateActivityFile(file));
validateActivityFile({name:'ROUTE.GPX',size:MAX_FILE_BYTES});
for(const xml of ['<!DOCTYPE gpx><gpx/>','<!ENTITY x "test">','<x:trkpt/>'.repeat(MAX_TRACK_POINTS+1),'é'.repeat(MAX_FILE_BYTES/2+1)])assert.throws(()=>validateActivityXML(xml));
validateActivityXML('<trkpt/>'.repeat(MAX_TRACK_POINTS));

const readers=[],results=[];
class Reader{constructor(){this.readyState=1;readers.push(this)}readAsText(){}abort(){this.aborted=true;this.readyState=2}}
const loader=createActivityReader((parsed,error)=>results.push({parsed,error}),Reader);
loader.load({name:'one.gpx',size:20});const old=readers[0],staleError=old.onerror;
loader.load({name:'two.gpx',size:20});assert.equal(old.aborted,true);staleError();assert.equal(results.length,0,'No publicar una lectura obsoleta');
readers[1].onerror();assert.equal(results.length,1);assert.match(results[0].error.message,/leer/);
loader.load({name:'three.gpx',size:20});const pending=readers.at(-1);loader.cancel();assert.equal(pending.aborted,true);assert.equal(pending.onload,null);
loader.load({name:'too-big.gpx',size:MAX_FILE_BYTES+1});assert.equal(readers.length,3,'Rechazar antes de crear el lector');

assert.deepEqual(await boundedJSON(Response.json({ok:true}),100),{ok:true});
let cancelled=false;
const oversized=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('x'.repeat(101)))},cancel(){cancelled=true}}));
await assert.rejects(boundedJSON(oversized,100),e=>e.status===413);assert.equal(cancelled,true);
await assert.rejects(boundedJSON(new Response('x',{headers:{'Content-Length':'101'}}),100),e=>e.status===413);
await assert.rejects(boundedJSON(new Response('invalid json'),100));
const request=new Request('https://example.test/api/route',{method:'POST',body:'x'.repeat(8193)});
assert.equal((await POST(request)).status,413);
assert.equal((await POST(new Request('https://example.test/api/route',{method:'POST',body:'{}',headers:{'sec-fetch-site':'cross-site'}}))).status,403);

// Un segmento largo con distancia cero no debe recorrer su historial para cada pendiente.
const points=Array.from({length:MAX_TRACK_POINTS},(_,i)=>({segmentId:0,breakBefore:i===0,ele:100,d:0,time:i*1000}));
const start=performance.now();assert.equal(slopeStats(points).maxUp,null);assert.equal(speedStats(points).max,null);
assert.ok(performance.now()-start<3000,'Métricas acotadas para 50 000 puntos');
console.log('Security checks passed: file size/type, DTD/entities, raw point cap, UTF-8, stale reads, cancel/reset, bounded API streams, 413, cross-site rejection and long-segment performance.');
