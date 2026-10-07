import test from'node:test';
import assert from'node:assert/strict';
import{DOMParser as XmldomParser}from'@xmldom/xmldom';

globalThis.DOMParser=class extends XmldomParser{
  parseFromString(source,mimeType){
    const document=super.parseFromString(source,mimeType);
    document.querySelector=selector=>selector==='parsererror'?null:null;
    return document;
  }
};

const{parseGPX,optionalNumber,validCoordinates}=await import('../app/js/gpx-parser.js');
const{parseTCX}=await import('../app/js/tcx-parser.js');
const{speedStats,heartZones,slopeStats}=await import('../app/js/metrics.js');
const{splitRouteSegments,createMap}=await import('../app/js/map.js');
const{splitChartSegments}=await import('../app/js/charts.js');

const time=second=>`2026-10-07T10:00:${String(second).padStart(2,'0')}Z`;
function gpxPoint(lat,lon,ele,second){
  const elevation=ele==null?'':`<ele>${ele}</ele>`;
  const timestamp=second==null?'':`<time>${time(second)}</time>`;
  return`<trkpt lat="${lat}" lon="${lon}">${elevation}${timestamp}<extensions><hr>${120+second||120}</hr></extensions></trkpt>`;
}
function gpxDocument(segments){
  return`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Test route</name>${segments.map(s=>`<trkseg>${s}</trkseg>`).join('')}</trk></gpx>`;
}
function tcxPoint({lat,lon,ele,timeText,hr=120}){
  const position=lat==null||lon==null?'':`<Position><LatitudeDegrees>${lat}</LatitudeDegrees><LongitudeDegrees>${lon}</LongitudeDegrees></Position>`;
  const altitude=ele==null?'':`<AltitudeMeters>${ele}</AltitudeMeters>`;
  const stamp=timeText?`<Time>${timeText}</Time>`:'';
  return`<Trackpoint>${stamp}${position}${altitude}<HeartRateBpm><Value>${hr}</Value></HeartRateBpm></Trackpoint>`;
}
function tcxDocument(tracks){
  return`<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>${time(0)}</Id>${tracks.map(points=>`<Lap><Track>${points}</Track></Lap>`).join('')}</Activity></Activities></TrainingCenterDatabase>`;
}
function fivePointSegment(baseLat,baseLon,startEle,startSecond){
  return Array.from({length:5},(_,i)=>gpxPoint(baseLat+i*0.0002,baseLon,startEle+i*2,startSecond+i));
}

test('optional values and geographic coordinates are validated instead of becoming zero',()=>{
  assert.equal(optionalNumber(''),null);
  assert.equal(optionalNumber('   '),null);
  assert.equal(optionalNumber(null),null);
  assert.equal(optionalNumber('123.5'),123.5);
  assert.equal(validCoordinates(null,-100),false);
  assert.equal(validCoordinates(91,-100),false);
  assert.equal(validCoordinates(20,-181),false);
  assert.equal(validCoordinates(20,-100),true);
});

test('GPX: missing elevation stays null and invalid coordinates split the run',()=>{
  const xml=gpxDocument([[
    gpxPoint('20','-100',null,0),
    gpxPoint('20.0001','-100',100,1),
    '<trkpt lat="20.0002"></trkpt>',
    gpxPoint('20.0003','-100',102,3),
    gpxPoint('20.0004','-100',104,4)
  ].join('')]);
  const activity=parseGPX(xml,'missing-data.gpx');
  assert.equal(activity.points[0].ele,null);
  assert.equal(activity.points.length,4);
  assert.equal(activity.points[0].segmentId,0);
  assert.equal(activity.points[1].segmentId,0);
  assert.equal(activity.points[2].segmentId,1);
  assert.equal(activity.points[2].breakBefore,true);
  assert.ok(activity.distance<30,'distance must exclude the gap across the invalid point');
  assert.ok(activity.points.every(p=>p.lat!==0||p.lon!==0));
});

test('GPX: separate trkseg groups do not add bridge distance or bridge elevation gain',()=>{
  const first=fivePointSegment(20,-100,100,0).join('');
  const second=fivePointSegment(21,-101,500,10).join('');
  const activity=parseGPX(gpxDocument([first,second]),'two-segments.gpx');
  assert.equal(activity.points.length,10);
  assert.equal(activity.points[5].breakBefore,true);
  assert.notEqual(activity.points[4].segmentId,activity.points[5].segmentId);
  assert.ok(activity.distance<1000,'only the within-segment point pairs should count');
  assert.ok(activity.ascent<20,'the altitude jump between trkseg groups must not count as ascent');
  assert.equal(splitRouteSegments(activity.points).length,2);
  assert.equal(splitChartSegments(activity.points.map(p=>[p.d/1000,p.ele,p.breakBefore])).length,2);
});

test('map: adds each route part as its own Leaflet polyline and fits all coordinates',()=>{
  const points=[
    {lat:20,lon:-100,segmentId:0,breakBefore:true},
    {lat:20.001,lon:-100,segmentId:0,breakBefore:false},
    {lat:21,lon:-101,segmentId:1,breakBefore:true},
    {lat:21.001,lon:-101,segmentId:1,breakBefore:false}
  ];
  const originalWindow=globalThis.window,originalDocument=globalThis.document;
  const calls={lines:[],bounds:null};
  const map={remove(){},fitBounds(bounds){calls.bounds=bounds},invalidateSize(){}};
  const marker=()=>({addTo(){return this},bindTooltip(){return this},setLatLng(){return this},setStyle(){return this}});
  const host={innerHTML:''},engine={innerHTML:''},status={textContent:''};
  globalThis.document={getElementById:id=>id==='map'?host:id==='engine'?engine:id==='mapStatus'?status:null};
  globalThis.window={L:{
    map:()=>map,
    tileLayer:()=>({addTo(){return this}}),
    polyline:coords=>{calls.lines.push(coords);return{addTo(){return this}}},
    circleMarker:marker,
    latLngBounds:coords=>coords,
    featureGroup:()=>{throw Error('createMap must not use FeatureGroup')}
  }};
  try{
    createMap(points);
    assert.equal(calls.lines.length,2);
    assert.deepEqual(calls.lines.map(line=>line.length),[2,2]);
    assert.equal(calls.bounds.length,4);
  }finally{
    if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
});

test('TCX: absent Position/AltitudeMeters is not treated as coordinates or altitude zero',()=>{
  const first=[
    tcxPoint({lat:20,lon:-100,ele:null,timeText:time(0)}),
    tcxPoint({lat:20.0001,lon:-100,ele:100,timeText:time(1)})
  ].join('');
  const second=[
    tcxPoint({lat:20.0002,lon:-100,ele:0,timeText:time(2)}),
    tcxPoint({lat:null,lon:null,ele:0,timeText:time(3)}),
    tcxPoint({lat:21,lon:-101,ele:null,timeText:time(4)}),
    tcxPoint({lat:21.0001,lon:-101,ele:null,timeText:time(5)})
  ].join('');
  const activity=parseTCX(tcxDocument([first,second]),'two-tracks.tcx');
  assert.equal(activity.points.length,5);
  assert.equal(activity.points[0].ele,null);
  assert.equal(activity.points[3].ele,null);
  assert.equal(activity.points[2].breakBefore,true,'a new Track starts a new run');
  assert.equal(activity.points[3].breakBefore,true,'a valid point after missing Position starts a new run');
  assert.equal(activity.points[4].breakBefore,false,'the next point in the valid run remains connected');
  assert.ok(activity.distance<30,'distance must not include jumps between tracks or across missing Position');
  assert.ok(activity.points.every(p=>p.lat!==0||p.lon!==0));
});

test('speed, heart-rate zones, and slope calculations do not use the interval across a track break',()=>{
  const first=[
    gpxPoint(20,-100,100,0),
    gpxPoint(20.0001,-100,100,1)
  ].join('');
  const second=[
    gpxPoint(20.0011,-100,100,6),
    gpxPoint(20.0012,-100,100,7)
  ].join('');
  const activity=parseGPX(gpxDocument([first,second]),'speed-gap.gpx');
  const speed=speedStats(activity.points);
  assert.ok(speed.max<45,`expected only within-track speed, got ${speed.max} km/h`);
  const zones=heartZones(activity.points);
  assert.equal(zones.reduce((sum,zone)=>sum+zone.time,0),2000);
  assert.equal(slopeStats(activity.points).avgUp,null);
});
