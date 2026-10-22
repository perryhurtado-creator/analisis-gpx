// IA-01: comparación no destructiva entre oráculo bruto y algoritmo filtrado real.
// Ejecutar desde raíz: node tests/ia01/compare-app.mjs
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {accumulateElevation} from '../../app/js/elevation.js';
const dir=dirname(fileURLToPath(import.meta.url));
const rows=readFileSync(join(dir,'resultados_esperados.csv'),'utf8').trim().split(/\r?\n/).slice(1);
let failures=0;
for(const row of rows){
 const [name,, ,rawUp,rawDown]=row.split(',');
 const xml=readFileSync(join(dir,'fixtures',name+'.gpx'),'utf8');
 const segments=[...xml.matchAll(/<trkseg>([\s\S]*?)<\/trkseg>/g)];
 let distance=0,rawAscent=0,rawDescent=0;
 const points=[];
 segments.forEach((segment,segmentId)=>{
  const nodes=[...segment[1].matchAll(/<trkpt\b[^>]*>([\s\S]*?)<\/trkpt>/g)];
  nodes.forEach((node,i)=>{
   const match=node[1].match(/<ele>([^<]+)<\/ele>/);
   const ele=match?Number(match[1]):null;
   const prev=points.at(-1);
   if(i>0){distance+=10;if(Number.isFinite(ele)&&Number.isFinite(prev.ele)){
     rawAscent+=Math.max(0,ele-prev.ele);rawDescent+=Math.max(0,prev.ele-ele);
   }}
   points.push({ele,d:distance,segmentId,breakBefore:i===0,up:0});
  });
 });
 const valid=Math.abs(rawAscent-Number(rawUp))<1e-6&&Math.abs(rawDescent-Number(rawDown))<1e-6;
 if(!valid)failures++;
 const app=accumulateElevation(points);
 console.log(JSON.stringify({case:name,oracle:valid?'PASS':'FAIL',rawAscent,rawDescent,filteredAscent:app.ascent,filteredDescent:app.descent,coverage:app.elevationStatus}));
}
console.log('Oráculo:',rows.length-failures,'/',rows.length);
if(failures)process.exitCode=1;
