import assert from 'node:assert/strict';
import {posterData,posterMapSnapshot,posterRuns} from '../js/poster-data.js';
const points=[{lat:20.5,lon:-100.4,d:0,ele:2000,segmentId:0,breakBefore:true},{lat:20.51,lon:-100.39,d:1000,ele:2050,segmentId:0},{lat:20.6,lon:-100.3,d:1000,ele:null,segmentId:1,breakBefore:true},{lat:20.61,lon:-100.29,d:2000,ele:2100,segmentId:1}];
const activity={name:'Ruta real',points,distance:21620,ascent:184,duration:5520000};
const data=posterData(activity);assert.equal(data.level,null,'No inventar clasificación');assert.equal(data.distancePts,2);assert.equal(data.elevationPts,1);assert.equal(data.elevationLabel,'DESNIVEL + · PARCIAL');assert.equal(data.time,'1 h 32 min');
assert.equal(posterData(activity,{name:'Nombre editado',level:'azul'}).name,'Nombre editado');assert.equal(posterData(activity,{level:'azul'}).level.label,'Azul — Intermedia Ligera');assert.equal(posterData(activity,{level:'inventado'}).level,null);
const absent=posterData({...activity,points:points.map(p=>({...p,ele:null})),duration:null});assert.equal(absent.ascent,'Sin datos');assert.equal(absent.time,'Sin datos');assert.equal(absent.elevationPts,null);
assert.deepEqual(posterRuns(points),[[0,1],[2,3]]);assert.deepEqual(posterRuns(points.map((p,i)=>({...p,segmentId:0,breakBefore:i===0||i===2}))),[[0,1],[2,3]]);
for(const route of [points,[points[0],points[0]],[{lat:10,lon:179.99},{lat:10.01,lon:-179.99}]]){
  const snap=posterMapSnapshot(route);assert(snap.tiles.length>0&&snap.tiles.length<=24);for(const p of snap.positions)assert(p.x>=44.9&&p.x<=snap.width-44.9&&p.y>=44.9&&p.y<=snap.height-44.9,'Toda la ruta cabe en el mapa');assert.equal(snap.positions.length,route.length);
}
assert.throws(()=>posterMapSnapshot([{lat:89,lon:0}]),/límites/);
for(const [distance,pts] of [[15000,1],[15001,2],[25000,2],[25001,3],[80000,5],[80001,6]])assert.equal(posterData({...activity,distance}).distancePts,pts);
console.log('PASS: clasificación elegida, datos ausentes/parciales, puntos, cortes, encuadre completo y antimeridiano.');
