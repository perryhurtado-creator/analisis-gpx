import assert from 'node:assert/strict';
import {createVideoElevation} from '../js/video-elevation.js';
import {cinematicCameraPose,droneCameraPose,cameraPose} from '../js/cesium-camera.js';
const calls=[];const ctx=new Proxy({measureText:()=>({width:0})},{get:(o,k)=>k in o?o[k]:(...args)=>calls.push([k,...args])});
globalThis.document={createElement:()=>({getContext:()=>ctx})};
const points=[{lat:20,lon:-100,d:0,ele:100,segmentId:0},{lat:20.01,lon:-100.01,d:10,ele:120,segmentId:0},{lat:20.02,lon:-100.02,d:100,ele:200,segmentId:1,breakBefore:true},{lat:20.03,lon:-100.03,d:200,ele:160,segmentId:1}];
const chart=createVideoElevation(points);const heights=[{index:0,height:100},{index:3,height:200}];
for(const poseFn of [cinematicCameraPose,droneCameraPose])for(const t of [0,.14,.3,.5,.8,.95,1]){const pose=poseFn(points,t,heights);const p=pose.trackProgress??t;const sample=chart.draw(ctx,p,654);const bike=cameraPose(points,p,heights);assert.equal(sample.point.lat,bike.lat);assert.equal(sample.point.lon,bike.lon);assert(Number.isFinite(sample.point.ele))}
assert(calls.filter(c=>c[0]==='moveTo').length>=2);assert(calls.some(c=>c[0]==='fillText'&&c[1]==='Altimetría'));
createVideoElevation(points.map(p=>({...p,ele:null}))).draw(ctx,.5,654);assert(calls.some(c=>c[0]==='fillText'&&c[1]==='Este archivo no incluye altitud.'));
console.log('PASS altitude cursor matches bicycle in both cameras, opening and closing; segment breaks and missing altitude supported.');
