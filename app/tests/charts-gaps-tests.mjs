import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {drawChart,setChartCursor,clearCharts} from '../js/charts.js';
const dom=new JSDOM('<div id="one"></div><div id="two"></div>');globalThis.document=dom.window.document;
const draw=(pairs,id='one')=>{drawChart(id,pairs,'#087443','Prueba',()=>null,()=>{});return document.getElementById(id)};
const path=host=>host.querySelector('path[fill="none"]').getAttribute('d');
let host=draw([[0,100],[1,null],[2,200]]);assert.equal((path(host).match(/M/g)||[]).length,2);assert(!path(host).includes('L'));assert.equal(host.querySelectorAll('circle').length,2);
host=draw([[0,0],[1,10],[2,NaN],[3,30],[4,40]]);assert.equal((path(host).match(/M/g)||[]).length,2);assert.equal((path(host).match(/L/g)||[]).length,2);
// Tanto los marcadores de corte como los identificadores de segmento interrumpen el trazo.
host=draw([[0,1,{segmentId:0}],[1,2,{segmentId:0}],[1,3,{segmentId:1}],[2,4,{segmentId:1}]]);assert.equal((path(host).match(/M/g)||[]).length,2);
host=draw([[0,1],[1,2],[1,3,{breakBefore:true}],[2,4]]);assert.equal((path(host).match(/M/g)||[]).length,2);
// La escala incluye la parte final sin sensor y los cursores siguen sincronizados.
host=draw([[0,10],[1,20],[2,null],[3,null]]);assert(host.textContent.includes('3 km'));
draw([[0,10],[1,20],[2,30],[3,40]],'two');setChartCursor(1);
assert.equal(host.querySelector('.guide').getAttribute('x1'),document.querySelector('#two .guide').getAttribute('x1'));
const stop=Number(path(host).match(/L([\d.]+)/)[1]);assert(stop<800,'El sensor no se estira hasta el final de la ruta');
// Una coordenada inválida corta el trazo y nunca genera un SVG con NaN.
host=draw([[0,10],[1,20],[NaN,30],[3,40],[4,50]]);assert.equal((path(host).match(/M/g)||[]).length,2);assert(!host.innerHTML.includes('NaN'));
host=draw([[0,null],[1,null]]);assert(!host.querySelector('svg'));clearCharts();setChartCursor(1);dom.window.close();
console.log('PASS gráficas: huecos de sensores, cortes, ceros válidos, puntos aislados, escala completa y cursores sincronizados.');
