import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import {parseGPX} from '../../app/js/gpx-parser.js';
import {parseTCX} from '../../app/js/tcx-parser.js';
import {validateActivityFile,MAX_FILE_BYTES} from '../../app/js/activity-limits.js';
const dir=dirname(fileURLToPath(import.meta.url));
globalThis.DOMParser=new JSDOM('').window.DOMParser;
const rows=readFileSync(join(dir,'resultados_esperados.csv'),'utf8').trim().split(/\r?\n/).slice(1);
let passed=0;
for(const row of rows){
 const [name,segments,count]=row.split(',');
 const xml=readFileSync(join(dir,'fixtures',name+'.gpx'),'utf8');
 const activity=parseGPX(xml,name+'.gpx');
 assert.equal(activity.type,'GPX',name);
 assert.equal(activity.points.length,Number(count),name);
 assert.equal(new Set(activity.points.map(p=>p.segmentId)).size,Number(segments),name);
 assert(Number.isFinite(activity.distance)&&activity.distance>=0,name);
 assert(activity.points.every(p=>p.ele===null||Number.isFinite(p.ele)),name);
 assert(activity.points.every(p=>p.up===null||Number.isFinite(p.up)),name);
 assert(activity.points.every(p=>p.down===null||Number.isFinite(p.down)),name);
 for(let i=1;i<activity.points.length;i++){
  const a=activity.points[i-1],b=activity.points[i];
  assert(b.d>=a.d,name);
  if(b.breakBefore||b.segmentId!==a.segmentId)assert.equal(b.d,a.d,name+' must not bridge segments');
 }
 passed++;console.log('PASS import GPX:',name);
}
const point=(lat,lon,ele,dist)=>'<Trackpoint><Time>2026-01-01T00:00:00Z</Time><Position><LatitudeDegrees>'+lat+'</LatitudeDegrees><LongitudeDegrees>'+lon+'</LongitudeDegrees></Position>'+(ele===null?'':'<AltitudeMeters>'+ele+'</AltitudeMeters>')+'<DistanceMeters>'+dist+'</DistanceMeters></Trackpoint>';
const tcx='<TrainingCenterDatabase><Activities><Activity><Lap><Track>'+point(20,-100,100,0)+point(20,-99.999,110,100)+'</Track><Track>'+point(21,-100,200,0)+point(21,-99.999,null,100)+'</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
const activity=parseTCX(tcx,'synthetic.tcx');
assert.equal(activity.type,'TCX');assert.equal(activity.points.length,4);
assert.equal(new Set(activity.points.map(p=>p.segmentId)).size,2);
assert.equal(activity.points[2].d,activity.points[1].d);
assert.equal(activity.points[3].ele,null);
console.log('PASS import TCX: separate tracks and missing elevation');
const zero='<gpx><trk><trkseg><trkpt lat="20" lon="-100"><ele>0</ele></trkpt><trkpt lat="20" lon="-99.999"><ele>5</ele></trkpt></trkseg></trk></gpx>';
assert.equal(parseGPX(zero,'zero.gpx').points[0].ele,0);
assert.throws(()=>parseGPX('<gpx><trk><trkseg><trkpt lat="20" lon="-100"/></trkseg></trk></gpx>','one.gpx'));
assert.throws(()=>parseGPX('<!DOCTYPE gpx><gpx/>','bad.gpx'));
assert.throws(()=>parseTCX('<gpx/>','bad.tcx'));
assert.doesNotThrow(()=>validateActivityFile({name:'ride.tcx',size:100}));
assert.doesNotThrow(()=>validateActivityFile({name:'ride.GPX',size:100}));
assert.throws(()=>validateActivityFile({name:'ride.txt',size:100}));
assert.throws(()=>validateActivityFile({name:'ride.gpx',size:MAX_FILE_BYTES+1}));
console.log('PASS import validations: zero, malformed input, extensions, size');
console.log('Import integration:',passed,'GPX fixtures + TCX + validations');
