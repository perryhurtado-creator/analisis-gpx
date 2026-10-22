import assert from 'node:assert/strict';
import {segments,duration} from '../js/metrics.js';
const near=(a,b)=>assert(Math.abs(a-b)<1e-7,`${a} ≠ ${b}`);
const sum=(rows,key)=>rows.reduce((s,r)=>s+(r[key]??0),0);
const route=(ds,times=ds.map(d=>d*100))=>({distance:ds.at(-1),points:ds.map((d,i)=>({d,time:times[i],segmentId:0,breakBefore:i===0,up:d/10,hr:140+i,cad:80,speed:36}))});
// El caso auditado perdía 400 m y 40 s entre las cinco filas.
let rows=segments(route(Array.from({length:11},(_,i)=>i*100)));
assert.equal(rows.length,5);near(sum(rows,'distance'),1);near(sum(rows,'time'),100000);near(sum(rows,'up'),100);
rows.forEach(r=>{near(r.distance,.2);near(r.time,20000);near(r.speed,36)});
// Un único intervalo puede cruzar los cuatro límites; no depende de tener puntos allí.
rows=segments(route([0,1000],[0,100000]));assert.equal(rows.length,5);rows.forEach(r=>{near(r.distance,.2);near(r.time,20000)});
// Muestreo irregular, tiempos desiguales y tiempo válido en cero.
rows=segments(route([0,50,370,810,1000],[0,5000,69000,91000,110000]));near(sum(rows,'distance'),1);near(sum(rows,'time'),110000);near(rows[0].time,35000);
// Pausa justo en un límite: se asigna una vez al tramo que comienza allí.
rows=segments(route([0,200,200,1000],[0,20000,50000,130000]));near(sum(rows,'time'),130000);near(rows[1].time,50000);
// Pausa final: no se pierde después del último metro.
rows=segments(route([0,1000,1000],[0,100000,120000]));near(sum(rows,'time'),120000);near(rows[4].time,40000);
// No asignar el hueco de tiempo ni una distancia artificial entre segmentos.
const split=route([0,400,400,1000],[0,40000,1000000,1060000]);split.points[2].segmentId=1;split.points[2].breakBefore=true;split.points[3].segmentId=1;
rows=segments(split);near(sum(rows,'distance'),1);near(sum(rows,'time'),100000);
const cut=route([0,300,700,1000],[0,30000,70000,100000]);cut.points[2].breakBefore=true;
rows=segments(cut);near(sum(rows,'distance'),.6);near(sum(rows,'time'),60000);
// Si falta un horario, la distancia se conserva y la velocidad usa solo distancia cronometrada.
rows=segments(route([0,100,300,1000],[0,10000,null,100000]));near(sum(rows,'distance'),1);near(sum(rows,'time'),10000);assert.equal(rows[2].time,null);
const noTimes=route([0,1000],[null,null]);noTimes.points.forEach(p=>{p.speed=null;p.hr=null;p.up=null});rows=segments(noTimes);assert(rows.every(r=>r.time===null&&r.speed===null&&r.hr===null&&r.up===null));
assert.deepEqual(segments(route([0,0],[0,1000])),[]);
assert.deepEqual(segments({distance:1000,points:[]}),[]);
// No modificar el archivo importado ni sus datos de sensores.
const source=route([0,123,456,1000]);const before=structuredClone(source);segments(source);assert.deepEqual(source,before);
assert.equal(duration(65000),'1 min');assert.equal(duration(65000,{seconds:true}),'1 min 5 s');
console.log('PASS tramos: conservación de distancia/tiempo/desnivel, límites interpolados, muestreo irregular, pausas, cortes y datos ausentes.');
