import assert from 'node:assert/strict';
import {mergeManualLabels} from '../js/poster-manual-localities.js';
const automatic={name:'San Pedro',lat:20,lon:-99.5};
const manual={name:'San Pedro',lat:20,lon:-100,manual:true,priority:0};
for(const list of [[automatic],[{...automatic,priority:3}]]){
  assert.deepEqual(mergeManualLabels(list,[manual]),[manual,...list],'CARTEL-MAN-01: conservar homónimos separados por 52 km, también sustitutas');
}
assert.deepEqual(mergeManualLabels([{...manual,name:'SÁN PEDRO',lat:20.001}],[manual]),[manual],'mismo nombre normalizado y menos de 250 m: prioridad manual');
const different={...manual,name:'San Pablo',lat:20.001};
assert.deepEqual(mergeManualLabels([different],[manual]),[manual,different],'proximidad sola no acredita identidad');
for(const invalid of [{name:'San Pedro'},{name:'San Pedro',lat:NaN,lon:-100},{name:'San Pedro',lat:91,lon:-100}]){
  assert.deepEqual(mergeManualLabels([invalid],[manual]),[manual,invalid],'sin coordenadas válidas no borrar por nombre');
}
for(const distance of [249,251]){
  const near={...manual,lat:20+distance/111320};
  assert.equal(mergeManualLabels([near],[manual]).length,distance<250?1:2,'umbral de fusión de 250 m');
}
console.log('PASS CARTEL-MAN-01: homónimos lejanos, coincidencias próximas, nombres distintos y coordenadas inválidas.');
