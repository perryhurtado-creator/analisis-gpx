import assert from 'node:assert/strict';
import {finalize} from '../js/gpx-parser.js';
const xml={getElementsByTagNameNS:()=>[],getElementsByTagName:()=>[]};
const make=(e,i,segmentId=0)=>({lat:20+i*.00001,lon:-100,ele:e,time:i*1000,speed:null,d:0,up:0,segmentId,breakBefore:i===0});
const run=points=>finalize(xml,points,'GPX','test.gpx');
// Cada punto sube 20 cm y avanza ~1 m: el antiguo filtro eliminaba toda la subida.
const gradual=run(Array.from({length:101},(_,i)=>make(1900+i*.2,i)));
assert(gradual.ascent>19&&gradual.ascent<21);assert.equal(gradual.points.at(-1).up,gradual.ascent);
assert(gradual.points.every((p,i)=>!i||p.up>=gradual.points[i-1].up));
const hills=[...Array.from({length:101},(_,i)=>1900+i*.5),...Array.from({length:100},(_,i)=>1950-(i+1)*.3),...Array.from({length:100},(_,i)=>1920+(i+1)*.4)];
const repeated=run(hills.map((e,i)=>make(e,i)));assert(repeated.ascent>87&&repeated.ascent<91);assert(repeated.descent>28&&repeated.descent<31);
const noisy=run(Array.from({length:100},(_,i)=>make(1900+(i%2? .2:0),i)));assert.equal(noisy.ascent,0);
const separated=[make(100,0),make(100,1),{...make(1000,2,1),breakBefore:true},make(1000,3,1)];assert.equal(run(separated).ascent,0);
assert.equal(run([make(100,0),make(null,1),make(1000,2)]).ascent,0);
const downhill=run(Array.from({length:101},(_,i)=>make(2000-i*.2,i)));assert.equal(downhill.ascent,0);assert(downhill.descent>19);
console.log('PASS gradual sub-metre climbs, repeated hills (~90 m), cumulative ascent, noise, segment breaks, missing altitude, downhill.');
