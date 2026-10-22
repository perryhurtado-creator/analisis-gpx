import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const base=dirname(fileURLToPath(import.meta.url));
const csv=readFileSync(join(base,'resultados_esperados.csv'),'utf8').trim().split(/\\r?\\n/).slice(1);
let failed=0;
for(const line of csv){
 const [name,ns,np,up,down]=line.split(',');
 const xml=readFileSync(join(base,'fixtures',name+'.gpx'),'utf8');
 const segments=[...xml.matchAll(/<trkseg>([\\s\\S]*?)<\\/trkseg>/g)].map(m=>[...m[1].matchAll(/<trkpt\\b[^>]*>([\\s\\S]*?)<\\/trkpt>/g)].map(p=>{const e=p[1].match(/<ele>([^<]+)<\\/ele>/);return e?Number(e[1]):null;}));
 let a=0,d=0;for(const seg of segments)for(let i=1;i<seg.length;i++){const x=seg[i-1],y=seg[i];if(x===null||y===null)continue; a+=Math.max(0,y-x);d+=Math.max(0,x-y);}
 const ok=segments.length===Number(ns)&&segments.reduce((n,s)=>n+s.length,0)===Number(np)&&Math.abs(a-Number(up))<=1e-6&&Math.abs(d-Number(down))<=1e-6;
 console.log((ok?'PASS':'FAIL')+' '+name+' ascenso='+a+' descenso='+d);if(!ok)failed++;
}
if(failed)process.exitCode=1;
