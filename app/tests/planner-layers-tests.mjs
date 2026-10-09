import assert from 'node:assert/strict';
import {addPlannerLayers} from '../js/planner-layers.js';
const events={},active=new Set(),state={textContent:''};let control;
globalThis.document={getElementById:()=>state};
const map={on(name,fn){events[name]=fn},hasLayer(layer){return active.has(layer)}};
const L={tileLayer:(url,options)=>({url,options,events:{},addTo(){active.add(this);return this},on(name,fn){this.events[name]=fn;return this}}),control:{layers:(layers,overlays,options)=>{control={layers,options};return {addTo(){}}}}};
const layers=addPlannerLayers(map,L),names=Object.keys(layers);assert.equal(names.length,3);assert.equal(active.size,1);assert.equal(control.options.position,'topright');
for(const layer of Object.values(layers)){assert.match(layer.url,/^https:/);assert.match(layer.options.attribution,/openstreetmap.org\/copyright/)}
active.clear();active.add(layers[names[1]]);events.baselayerchange({name:names[1]});assert.match(state.textContent,/CyclOSM/);layers[names[1]].events.tileerror();assert.match(state.textContent,/No se pudo cargar/);
events.baselayerchange({name:names[0]});assert.match(state.textContent,/Capa: Estándar/);
console.log('Layer checks passed: three basemaps, default layer, attribution, selection and error feedback');
