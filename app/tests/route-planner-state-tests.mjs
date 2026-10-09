import assert from 'node:assert/strict';
import {openPlanner,routeGPX} from '../js/route-planner.js';
const elements=new Map();const element=()=>({textContent:'',disabled:true,value:'',children:[],dataset:{},focus(){},append(child){this.children.push(child)},replaceChildren(){this.children=[]}});globalThis.document={createElement:element,getElementById:id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id)}};
const $=id=>document.getElementById(id);globalThis.requestAnimationFrame=fn=>fn();
const clicks={},pins=[];let activeLayers=0;
const map={setView(){return this},on(event,fn){clicks[event]=fn;return this},invalidateSize(){},fitBounds(){},getCenter(){return {lat:20.5,lng:-100.4}},hasLayer(){return true}};
globalThis.window={L:{map:()=>map,tileLayer:()=>({addTo(){return this},on(){return this}}),control:{layers:()=>({addTo(){}})},divIcon:o=>o,marker:point=>{const events={};const m={point,events,getLatLng(){return this.point},setLatLng(p){this.point=p},addTo(){return this},bindTooltip(){return this},setIcon(icon){this.icon=icon;return this},setTooltipContent(text){this.tooltip=text;return this},on(event,fn){events[event]=fn;return this},remove(){}};pins.push(m);return m},geoJSON:()=>({addTo(){activeLayers++;return this},remove(){activeLayers--},getBounds(){return {}}})}};
const response=(distance=1000)=>Response.json({geometry:{type:'LineString',coordinates:[[-100.4,20.5],[-100.3,20.6]]},distance,duration:600});
let pending=[];globalThis.fetch=async(url,options)=>{assert.ok(url==='/api/route'||url.startsWith('/api/places?'));return new Promise(resolve=>pending.push({resolve,options,url}))};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
openPlanner();clicks.click({latlng:{lat:20.5,lng:-100.4}});assert.match($('plannerStatus').textContent,/Destino/);assert.ok($('plannerDownload').disabled);
clicks.click({latlng:{lat:20.6,lng:-100.3}});assert.equal(pending.length,1);assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[[-100.4,20.5],[-100.3,20.6]]);
pending.shift().resolve(response());await settle();assert.equal(activeLayers,1);assert.equal($('plannerDistance').textContent,'1 km');assert.equal($('plannerDownload').disabled,false);
$('plannerInvert').onclick();assert.equal(activeLayers,0);assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[[-100.3,20.6],[-100.4,20.5]]);pending.shift().resolve(response());await settle();
pins[0].events.dragstart();assert.equal(activeLayers,0);pins[0].point={lat:20.7,lng:-100.2};pins[0].events.dragend();const stale=pending.shift();
$('plannerRetry').onclick();assert.ok(stale.options.signal.aborted);const latest=pending.shift();latest.resolve(response(2000));await settle();stale.resolve(response(9000));await settle();assert.equal($('plannerDistance').textContent,'2 km');
$('plannerRetry').onclick();pending.shift().resolve(Response.json({error:'Sin conexión entre puntos'},{status:422}));await settle();assert.equal(activeLayers,0);assert.ok($('plannerDownload').disabled);assert.equal($('plannerStatus').textContent,'Sin conexión entre puntos');
// Insert two intermediate points before B, preserving A and B.
$('plannerAdd').onclick();clicks.click({latlng:{lat:20.55,lng:-100.35}});
assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[[-100.3,20.6],[-100.35,20.55],[-100.2,20.7]]);
pending.shift().resolve(response(3000));await settle();assert.match($('plannerWaypoints').innerHTML,/Punto 1/);assert.equal($('plannerPointCount').textContent,'3 puntos · Origen → Destino');
$('plannerAdd').onclick();clicks.click({latlng:{lat:20.57,lng:-100.34}});pending.shift().resolve(response(4000));await settle();
// Move endpoints through map taps; recalculate all four points.
$('plannerMoveOrigin').onclick();clicks.click({latlng:{lat:20.61,lng:-100.31}});
assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[[-100.31,20.61],[-100.35,20.55],[-100.34,20.57],[-100.2,20.7]]);pending.shift().resolve(response());await settle();
$('plannerMoveDestination').onclick();clicks.click({latlng:{lat:20.71,lng:-100.21}});assert.deepEqual(JSON.parse(pending[0].options.body).coordinates.at(-1),[-100.21,20.71]);pending.shift().resolve(response());await settle();
// Drag a waypoint and verify its new coordinate is included.
pins[2].events.dragstart();pins[2].point={lat:20.56,lng:-100.36};pins[2].events.dragend();assert.deepEqual(JSON.parse(pending[0].options.body).coordinates[1],[-100.36,20.56]);pending.shift().resolve(response());await settle();
// Reverse the entire waypoint order, then delete an intermediate point.
const order=[[-100.31,20.61],[-100.36,20.56],[-100.34,20.57],[-100.21,20.71]];
$('plannerInvert').onclick();assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,order.toReversed());pending.shift().resolve(response());await settle();
$('plannerWaypoints').onclick({target:{closest:()=>({dataset:{removeWaypoint:'1'}})}});assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[order[3],order[1],order[0]]);pending.shift().resolve(response());await settle();
$('plannerRetry').onclick();const cleared=pending.shift();$('plannerClear').onclick();cleared.resolve(response());await settle();assert.equal(activeLayers,0);assert.equal($('plannerDistance').textContent,'—');assert.equal($('plannerOrigin').textContent,'Sin seleccionar');assert.equal($('plannerWaypoints').innerHTML,'');assert.ok($('plannerInvert').disabled);assert.ok($('plannerDownload').disabled);
const gpx=routeGPX({geometry:{coordinates:[[-100.4,20.5],[-100.3,20.6]]}});assert.match(gpx,/<trkpt lat="20.5" lon="-100.4">/);assert.ok(!gpx.includes('<time>'));assert.ok(!gpx.includes('<ele>'));assert.match(gpx,/<trkseg>/);
// Search a place, choose it as A, and recalculate while retaining B and waypoints.
$('plannerOriginQuery').value='Santa Bárbara, Corregidora';const search=$('plannerOriginSearch').onsubmit({preventDefault(){}});assert.ok(pending[0].url.includes('Santa'));pending.shift().resolve(Response.json({places:[{label:'Santa Bárbara <b>Qro</b>',lat:20.53,lon:-100.42}]}));await search;
assert.equal($('plannerOriginResults').children[0].children[0].textContent,'Santa Bárbara <b>Qro</b>');
$('plannerOriginResults').onclick({target:{closest:()=>({dataset:{placeIndex:'0'}})}});assert.equal($('plannerOrigin').textContent,'20.53000, -100.42000');assert.equal(pending.length,0);
clicks.click({latlng:{lat:20.59,lng:-100.39}});pending.shift().resolve(response());await settle();
$('plannerOriginQuery').value='Querétaro';const search2=$('plannerOriginSearch').onsubmit({preventDefault(){}});pending.shift().resolve(Response.json({places:[{label:'Querétaro',lat:20.5888,lon:-100.3899}]}));await search2;
$('plannerOriginResults').onclick({target:{closest:()=>({dataset:{placeIndex:'0'}})}});assert.deepEqual(JSON.parse(pending[0].options.body).coordinates,[[-100.3899,20.5888],[-100.39,20.59]]);pending.shift().resolve(response());await settle();
// Query changes invalidate stale searches; clearing does too.
const oldSearch=$('plannerOriginSearch').onsubmit({preventDefault(){}}),old=pending.shift();$('plannerOriginQuery').oninput();old.resolve(Response.json({places:[{label:'Old',lat:0,lon:0}]}));await oldSearch;assert.equal($('plannerOriginResults').children.length,0);
const emptySearch=$('plannerOriginSearch').onsubmit({preventDefault(){}});pending.shift().resolve(Response.json({places:[]}));await emptySearch;assert.match($('plannerSearchStatus').textContent,/No se encontraron/);
$('plannerClear').onclick();assert.equal($('plannerOriginResults').children.length,0);
console.log('Planner state checks passed: place search, origin selection/recalculation, empty and stale searches;  selection, coordinate order, inversion, drag, stale responses, error, waypoints, endpoint relocation, waypoint drag/deletion, reversed order, clear during request, GPX');
