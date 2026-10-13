import assert from 'node:assert/strict';
import {closingLegend,drawClosingLegend} from '../js/video-closing.js';
const activity={name:'La Magnífica',distance:70000,ascent:1234,points:[{d:70000,ele:2000}]};
const legend=closingLegend(activity);assert.equal(legend.name,'La Magnífica');assert(legend.metrics.includes('70 km'));assert(legend.metrics.includes('1,234 m'));
assert(closingLegend({...activity,points:[{d:70000}]}).metrics.endsWith('—'));
const calls=[];const ctx=new Proxy({measureText:t=>({width:t.length*15})},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push([k,...a])});
drawClosingLegend(ctx,activity,.94,1280,648);assert.equal(calls.length,0);
drawClosingLegend(ctx,activity,.98,1280,648);assert(calls.some(c=>c[0]==='fillText'&&c[1]==='La Magnífica'));assert.equal(calls.at(-1)[0],'restore');
console.log('PASS last two seconds show route name, total distance and recorded ascent; absent altitude not reported as zero.');
