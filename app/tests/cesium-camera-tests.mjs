import assert from 'node:assert/strict';
import {routeChunks,terrainSampleIndices,cameraPose,sampleDistancePoint,cinematicCameraPose} from '../js/cesium-camera.js';
const points=[{lat:20,lon:-100,d:0,segmentId:0,breakBefore:true},{lat:20.1,lon:-100.1,d:100,segmentId:0},{lat:21,lon:-101,d:100,segmentId:1,breakBefore:true},{lat:21.1,lon:-101.1,d:200,segmentId:1}];
assert.deepEqual(routeChunks(points).map(p=>p.length),[2,2]);
const samples=points.map((p,i)=>({index:i,height:2000+i*10}));
const first=cameraPose(points,0,samples),last=cameraPose(points,1,samples);
assert.equal(first.lat,20);assert.equal(first.height,2020);assert.equal(last.lat,21.1);assert.equal(last.height,2050);
const gap=cameraPose(points,.5,samples);assert.equal(gap.lat,20.1,'No interpolar cámara a través del corte');assert.equal(gap.height,2030);
const mid=cameraPose(points,1/6,samples);assert.equal(mid.lat,20.05);assert.equal(mid.height,2025);assert(mid.pitch<0&&mid.range>=500);
const long=Array.from({length:10000},(_,i)=>({lat:20,lon:-100,d:i,segmentId:i<5051?0:1,breakBefore:i===0||i===5051}));
const indices=terrainSampleIndices(long);assert(indices.includes(0)&&indices.includes(9999)&&indices.includes(5050)&&indices.includes(5051));assert(indices.length<=100);
assert.equal(cameraPose(long,1,indices.map(i=>({index:i,height:2000}))).range,2000);
console.log('PASS: cámara aérea interpolada, alturas de terreno independientes del GPX, cortes y muestreo acotado.');

const uneven=[{lat:20,lon:-100,d:0,segmentId:0},{lat:20,lon:-99.999,d:100,segmentId:0},{lat:20,lon:-99.99,d:1000,segmentId:0}];
assert(Math.abs(sampleDistancePoint(uneven,.5).point.lon-(-99.995))<1e-9,'La mitad de la distancia no es la mitad de los puntos');
const hairpin=Array.from({length:201},(_,i)=>({lat:20+(i<100?i:200-i)*.0001,lon:-100+(i>100?.0001:0),d:i*11,segmentId:0}));
const ground=hairpin.map((p,index)=>({index,height:2000}));
let previous=cinematicCameraPose(hairpin,.14,ground);
for(let i=1;i<=633;i++){const p=.14+i/24/40;if(p>.8)break;const pose=cinematicCameraPose(hairpin,p,ground);assert(Math.abs(pose.heading-previous.heading)<=24/24+.01,'Giro limitado incluso en horquillas');previous=pose}
assert.deepEqual(cinematicCameraPose(hairpin,.95,ground),cinematicCameraPose(hairpin,1,ground),'Cierre inmóvil dos segundos');
console.log('PASS: distancia uniforme, horquillas sin giros bruscos y cierre fijo.');

for(const progress of [0,.05,.14,.3,.5,.7,.8,.9,.95,1]){
 const pose=cinematicCameraPose(hairpin,progress,ground);assert.equal(pose.heading,0,'Orientación fija incluso en curvas, entrada y cierre');assert.equal(pose.pitch,-50,'Sin cambios de inclinación');assert(pose.range>=1100);
}
console.log('PASS: orientación e inclinación constantes y encuadre amplio.');

const opening=cinematicCameraPose(points,0,samples);
for(let frame=0;frame<960;frame++){
 const pose=cinematicCameraPose(points,frame/959,samples);
 assert.equal(pose.lon,opening.lon);assert.equal(pose.lat,opening.lat);assert.equal(pose.height,opening.height,'El relieve y el marcador no arrastran la cámara');
}
assert.notEqual(cinematicCameraPose(points,.2,samples).trackProgress,cinematicCameraPose(points,.7,samples).trackProgress,'El punto sigue avanzando con cámara fija');
const wide=cinematicCameraPose(points,.5,samples);assert(wide.range+1e-6>=Math.hypot(1.1*111320,1.1*111320*Math.cos(wide.lat*Math.PI/180))*1.6);
console.log('PASS: encuadre de toda la ruta independiente del punto durante los 960 fotogramas.');
