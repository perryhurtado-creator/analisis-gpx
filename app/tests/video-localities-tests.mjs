import assert from 'node:assert/strict';
import {localityBounds,localitiesAlongRoute,visibleLocalities,loadRouteLocalities} from '../js/video-localities.js';
import {cinematicBounds,cinematicCameraPose} from '../js/cesium-camera.js';
const points=[{lat:20,lon:-100,d:0,segmentId:0},{lat:20,lon:-99.98,d:2100,segmentId:0},{lat:20,lon:-99.94,d:2100,segmentId:1,breakBefore:true},{lat:20,lon:-99.92,d:4200,segmentId:1}];
assert.deepEqual(localityBounds(points),[19.98,-100.02,20.02,-99.9]);
const places=[{name:'Paso real',lat:20,lon:-99.99},{name:'En el corte',lat:20,lon:-99.96},{name:'Cercano',lat:20.004,lon:-99.925},{name:'Lejano',lat:20.05,lon:-99.99},{name:'Inválido',lat:null,lon:-99.99}];
const filtered=localitiesAlongRoute(points,places);
assert.deepEqual(filtered.map(p=>p.name),['Paso real','Cercano']);assert(Math.abs(filtered[0].distance-1050)<1);
assert.equal(localitiesAlongRoute(points,[places[0],places[0]]).length,1);
assert.equal(visibleLocalities(filtered,1050,4200)[0].alpha,1);assert.equal(visibleLocalities(filtered,20000,4200).length,0);
assert.equal(visibleLocalities(Array.from({length:10},(_,i)=>({distance:100+i})),105,10000).length,3);
let calls=0;const fetcher=async url=>{calls++;assert(url.startsWith('/api/localities?bbox='));return Response.json({places})};
const signal=new AbortController().signal;assert.equal((await loadRouteLocalities(points,signal,fetcher)).length,2);await loadRouteLocalities(points,signal,fetcher);assert.equal(calls,1);
const controller=new AbortController();controller.abort();await assert.rejects(loadRouteLocalities(points,controller.signal,fetcher),{name:'AbortError'});
const other=points.map(p=>({...p,lat:p.lat+1}));await assert.rejects(loadRouteLocalities(other,signal,async()=>Response.json({error:'outage'},{status:502})),/consultar/);
const samples=points.map((p,index)=>({index,height:2000})),bounds=cinematicBounds(points);
for(const progress of [0,.14,.5,.86,1]){const pose=cinematicCameraPose(points,progress,samples,bounds);assert(Object.values(pose).every(Number.isFinite));assert(pose.pitch<0&&pose.range>0)}
const before=cinematicCameraPose(points,.47-1e-6,samples,bounds),after=cinematicCameraPose(points,.47+1e-6,samples,bounds);assert(before.lon<=-99.98&&after.lon>=-99.94,'El corte es un salto, nunca un tramo interpolado');
for(const boundary of [.14,.80,.95]){const a=cinematicCameraPose(points,boundary-1e-6,samples,bounds),b=cinematicCameraPose(points,boundary+1e-6,samples,bounds);assert(Math.abs(a.range-b.range)<1);assert(Math.abs(a.heading-b.heading)<.1)}
console.log('PASS: localidades junto a tramos reales, cortes, cercanía, duplicados, fundido, límites, caché, errores, cancelación y cámara cinematográfica.');
