import assert from 'node:assert/strict';
import {slopeStats,speedStats,averageSpeed} from '../js/metrics.js';
import {JSDOM} from 'jsdom';
import {parseTCX} from '../js/tcx-parser.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} ≠ ${b}`);
const ramp=ds=>ds.map((d,i)=>({d,ele:100+d/10,segmentId:0,breakBefore:i===0}));
assert.equal(slopeStats(ramp([0,30,59.9])).maxUp,null,'No anunciar 60 m con menos distancia');
for(const ds of [[0,60],[0,100],[0,17,53,89,140],[0,10,20,30,40,50,60]]){
 const stats=slopeStats(ramp(ds));near(stats.maxUp,10);near(stats.sustainedUp.dd,60);
 near(stats.sustainedUp.to-stats.sustainedUp.from,60);
}
const shifted=slopeStats([0,20,50,100].map((d,i)=>({d,ele:[0,-10,20,20][i],segmentId:0})));
near(shifted.maxUp,50);near(shifted.sustainedUp.from,20);near(shifted.sustainedUp.to,80);
const fall=ramp([0,21,47,80]).map(p=>({...p,ele:200-p.d/5}));near(slopeStats(fall).maxDown,-20);
assert.equal(slopeStats(ramp([0,30,60,90]).map((p,i)=>({...p,ele:i===1?null:p.ele}))).maxUp,null);
for(const cut of [{breakBefore:true},{segmentId:1}]){
 const ps=ramp([0,30,30,60]).map((p,i)=>({...p,...(i>=2?cut:{})}));assert.equal(slopeStats(ps).maxUp,null);
}
const sensor=(speeds,{dt=1000,recorded=true}={})=>speeds.map((speed,i)=>({speed,speedSource:'sensor',d:i*10,recordedDistance:recorded?i*10:null,time:i*dt,segmentId:0,breakBefore:i===0}));
let ps=sensor([36,36,120,36,36]);let result=speedStats(ps);
assert.equal(result.max,36,'Pico aislado de 120 km/h con distancia de 36 km/h');assert.equal(result.source,'sensor');assert.equal(averageSpeed(ps).value,36);assert.equal(result.rejected,1);
assert.deepEqual(ps,sensor([36,36,120,36,36]),'No mutar muestras originales');
assert.equal(speedStats(sensor([36,36,36])).max,36);
assert.equal(speedStats(sensor([120,120,120])).source,'gps','Distancia contradice incluso picos repetidos');
assert.equal(speedStats(sensor([120,120,120]).map((p,i)=>({...p,recordedDistance:i*100/3}))).max,120,'No recortar velocidades altas corroboradas');
assert.equal(speedStats(sensor([0,0,0]).map(p=>({...p,recordedDistance:0}))).max,0);
assert.equal(speedStats(sensor([35,36,37],{recorded:false})).max,37,'Sensor sin DistanceMeters con apoyo temporal');
assert.equal(speedStats(sensor([35,120,35],{recorded:false})).max,null,'Sin distancia ni apoyo de otra muestra');
assert.notEqual(speedStats(sensor([120,120,120]).map(p=>({...p,time:null}))).source,'sensor');
assert.notEqual(speedStats(sensor([120,120]).map((p,i)=>({...p,segmentId:i,breakBefore:true}))).source,'sensor');
assert.notEqual(speedStats(sensor([120,120],{dt:31000,recorded:false})).source,'sensor');
assert.notEqual(speedStats(sensor([120,120],{dt:0,recorded:false})).source,'sensor');
assert.notEqual(speedStats(sensor([120,120]).map((p,i)=>({...p,recordedDistance:100-i*10}))).source,'sensor');
const gps=sensor([36,36,150,36,36,36,36]).map(p=>({...p,speedSource:'gps',recordedDistance:p.d}));
assert.equal(speedStats(gps).source,'gps','DistanceMeters no convierte velocidad GPS en sensor');assert.equal(speedStats(gps).max,36);
console.log('PASS auditoría: pendientes exactas de 60 m, interpolación, cortes y validación de máxima de sensor por tiempo, distancia y continuidad.');

// Recorrer también el lector TCX real, no solo puntos fabricados.
globalThis.DOMParser=new JSDOM('').window.DOMParser;
const xml='<TrainingCenterDatabase><Activities><Activity><Lap><Track>'+[36,36,120,36,36].map((speed,i)=>`<Trackpoint><Time>${new Date(1700000000000+i*1000).toISOString()}</Time><Position><LatitudeDegrees>20</LatitudeDegrees><LongitudeDegrees>${-100+i*.0001}</LongitudeDegrees></Position><DistanceMeters>${i*10}</DistanceMeters><Extensions><Speed>${speed/3.6}</Speed></Extensions></Trackpoint>`).join('')+'</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
const activity=parseTCX(xml,'sensor.tcx');near(activity.points[2].speed,120);assert.equal(speedStats(activity.points).max,36);
assert.equal(averageSpeed(activity.points).value,36,'La media tampoco conserva el pico descartado');
