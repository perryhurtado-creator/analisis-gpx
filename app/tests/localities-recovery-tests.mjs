import assert from 'node:assert/strict';
import {fetchAreaLocalitiesResult} from '../js/video-localities.js';
import {posterLocalities} from '../js/poster-localities.js';

const points=[{lat:20.56,lon:-100.36,d:0,segmentId:0},{lat:20.57,lon:-100.35,d:1500,segmentId:0}];
const signal=new AbortController().signal;
const place={name:'Comunidad de prueba',lat:20.565,lon:-100.355};
let calls=0;
const fetcher=async()=>{
  calls++;
  return calls===1?Response.json({places:[place],partial:true,source:'partial-catalogue'}):
    Response.json({places:[{...place,place:'village',population:'2500'}],source:'catalogue+overpass'});
};
const first=await posterLocalities(points,signal,{external:true,fetcher});
assert.match(first.message,/No se pudieron obtener categorías/);
assert.equal(first.retry,true);
assert.equal(calls,1);
const next=await posterLocalities(points,signal,{external:true,fetcher});
assert.equal(calls,2,'volver a generar recupera datos tras respuesta parcial');
assert(next.places.some(p=>p.name===place.name&&p.kind==='village'));
assert.match(next.message,/consulta por área/);
assert.equal(next.retry,false);
await posterLocalities(points,signal,{external:true,fetcher});
assert.equal(calls,2,'la respuesta completa sí se reutiliza');

const other=points.map(p=>({...p,lat:p.lat+1}));
let truncatedCalls=0;
const truncated=async()=>{truncatedCalls++;return Response.json({places:[],truncated:true})};
assert.equal((await fetchAreaLocalitiesResult(other,signal,truncated)).truncated,true);
await fetchAreaLocalitiesResult(other,signal,truncated);
assert.equal(truncatedCalls,2,'una respuesta truncada no queda retenida durante la sesión');
console.log('PASS recuperación: aviso de catálogo parcial, reintento, categorías recuperadas y caché solo completa.');
