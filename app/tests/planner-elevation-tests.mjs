import assert from 'node:assert/strict';
import {elevationProfile,elevationSVG} from '../js/planner-elevation.js';
const coords=[[-100,20,1800],[-100.01,20.01,1840],[-100.02,20.02,1820]];
const p=elevationProfile(coords,3000);assert.equal(p.ascent,40);assert.equal(p.descent,20);assert.equal(p.min,1800);assert.equal(p.max,1840);assert.equal(p.points.at(-1).d,3000);assert.ok(p.points[1].d>0);assert.match(elevationSVG(p),/<svg/);
const provider=elevationProfile(coords,3000,35,18);assert.equal(provider.ascent,35);assert.equal(provider.descent,18);
const missing=elevationProfile([[-100,20,0],[-100.01,20.01,null],[-100.02,20.02,10]],3000);assert.equal(missing.ascent,null);assert.equal(missing.descent,null);assert.equal(missing.min,0);assert.equal(missing.complete,false);assert.equal((elevationSVG(missing).match(/M/g)||[]).length,2);
const absent=elevationProfile([[-100,20],[-100.01,20.01]],1000);assert.equal(absent.min,null);assert.equal(absent.ascent,null);assert.match(elevationSVG(absent),/No hay datos/);
const flat=elevationProfile([[-100,20,0],[-100.01,20.01,0]],1000);assert.equal(flat.ascent,0);assert.equal(flat.descent,0);assert.match(elevationSVG(flat),/<svg/);
console.log('Elevation checks passed: ascent/descent, provider totals, distance axis, missing/zero elevation, disconnected profile, flat terrain');
