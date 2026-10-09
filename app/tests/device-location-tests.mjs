import assert from 'node:assert/strict';
import {currentLocation} from '../js/device-location.js';
const saved=Object.getOwnPropertyDescriptor(globalThis,'navigator');
try{
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{geolocation:{getCurrentPosition(success,error,options){assert.equal(options.enableHighAccuracy,true);assert.equal(options.maximumAge,0);assert.equal(options.timeout,15000);success({coords:{latitude:20.5,longitude:-100.4,accuracy:15}})}}}});
 const place=await currentLocation();assert.equal(place.lat,20.5);assert.equal(place.lon,-100.4);assert.match(place.label,/15 m/);
 for(const [code,text] of [[1,/No se autorizó/],[2,/No se pudo obtener/],[3,/agotó el tiempo/]]){navigator.geolocation.getCurrentPosition=(success,error)=>error({code});await assert.rejects(currentLocation(),text)}
 navigator.geolocation.getCurrentPosition=success=>success({coords:{latitude:NaN,longitude:0}});await assert.rejects(currentLocation(),/inválida/);
 delete navigator.geolocation;await assert.rejects(currentLocation(),/Este navegador/);
 console.log('Device location checks passed: explicit position request, accuracy, permission denial, unavailable location, timeout, invalid coordinates, unsupported browser');
}finally{if(saved)Object.defineProperty(globalThis,'navigator',saved);else delete globalThis.navigator}
