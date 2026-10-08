import test from 'node:test';
import assert from 'node:assert/strict';
import {createVideoTimeline,videoRouteChunks,videoSettings} from '../js/video-timeline.js';

const point=(lat,d,time,extra={})=>({lat,lon:-100,ele:lat*10,speed:20,d,time,segmentId:0,breakBefore:false,...extra});
test('distance sampling is independent of GPS sampling density and does not mutate data',()=>{
  const points=[point(0,0,0),point(1,10,1000),point(10,100,10000)];
  const before=JSON.stringify(points);points.forEach(Object.freeze);Object.freeze(points);
  const timeline=createVideoTimeline(points,{duration:30});
  const sample=timeline.at(.5);
  assert.equal(sample.point.d,50);assert.equal(sample.point.lat,5);assert.equal(sample.point.ele,50);
  assert.equal(sample.index,1);assert.ok(sample.mix>0&&sample.mix<1);
  assert.equal(timeline.duration,30);assert.equal(JSON.stringify(points),before);
});
test('time playback preserves stops; distance playback does not stretch them',()=>{
  const points=[point(0,0,0),point(0,0,8000),point(10,100,10000)];
  assert.equal(createVideoTimeline(points,{mode:'time'}).at(.5).point.lat,0);
  assert.equal(createVideoTimeline(points,{mode:'distance'}).at(.5).point.lat,5);
});
test('gaps hold the last point until the next segment and never draw connecting edges',()=>{
  const points=[point(0,0,0),point(1,10,1000),point(50,10,9000,{segmentId:1,breakBefore:true}),point(51,20,10000,{segmentId:1})];
  const timeline=createVideoTimeline(points,{mode:'time',tailSeconds:5,duration:10});
  const gap=timeline.at(.5);assert.equal(gap.point.lat,1);assert.equal(gap.mix,0);assert.equal(gap.inGap,true);
  const end=timeline.at(.95);
  assert.deepEqual(videoRouteChunks(points,end).map(run=>run.map(p=>p.lat)),[[0,1],[50,50.5]]);
  assert.deepEqual(videoRouteChunks(points,end,timeline.trailStart(end)).map(run=>run.map(p=>p.lat)),[[1],[50,50.5]]);
  assert.equal(createVideoTimeline(points).at(.5).point.lat,50);
});
test('invalid, missing and reversed timestamps fall back to distance',()=>{
  for(const times of [[0,null,2000],[2000,1000,3000],[1000,1000,1000]]){
    const timeline=createVideoTimeline(times.map((t,i)=>point(i,i*10,t)),{mode:'time'});
    assert.equal(timeline.mode,'distance');assert.equal(timeline.requestedMode,'time');assert.equal(timeline.at(.25).point.lat,.5);
  }
});
test('missing sensor values stay missing during interpolation; boundaries retain original values',()=>{
  const timeline=createVideoTimeline([point(0,0,0),point(10,10,1000,{ele:null,speed:null})]);
  assert.equal(timeline.at(.5).point.ele,null);assert.equal(timeline.at(.5).point.speed,null);
  assert.equal(timeline.at(0).point.speed,20);assert.equal(timeline.at(1).point.ele,null);
});
test('trail window interpolates its first and last positions on the same clock',()=>{
  const points=[point(0,0,0),point(10,100,10000)],timeline=createVideoTimeline(points,{duration:10,tailSeconds:2});
  const end=timeline.at(.5),start=timeline.trailStart(end);
  assert.equal(start.point.lat,3);assert.deepEqual(videoRouteChunks(points,end,start).map(run=>run.map(p=>p.lat)),[[3,5]]);
});
test('degenerate routes, duplicate keys and duration limits are safe',()=>{
  const timeline=createVideoTimeline([point(0,0,null),point(0,0,null),point(0,0,null)]);
  assert.equal(timeline.mode,'points');assert.equal(timeline.at(1).index,2);
  assert.equal(createVideoTimeline([point(0,0,null)]).at(.5).index,0);
  assert.equal(videoSettings({duration:500}).duration,120);assert.equal(videoSettings({duration:1}).duration,3);
  assert.equal(videoSettings({duration:NaN}).duration,9);
});
