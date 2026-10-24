import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {parseGPX,childText,isGenericActivityName} from '../js/gpx-parser.js';
import {posterData} from '../js/poster-data.js';
globalThis.DOMParser=new JSDOM('').window.DOMParser;

const pts='<trkseg><trkpt lat="20.5" lon="-100.4"><ele>1900</ele></trkpt><trkpt lat="20.51" lon="-100.39"><ele>1910</ele></trkpt></trkseg>';
const gpx=({metadata='',trk=''})=>`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1" version="1.1">${metadata?`<metadata>${metadata}</metadata>`:''}<trk>${trk}${pts}</trk></gpx>`;
const parse=(xml,file)=>parseGPX(xml,file);

// Causa raíz: el código anterior tomaba el primer <name> del documento, estuviera donde estuviera.
const generic=gpx({metadata:'<name>Ciclismo al aire libre</name>',trk:'<name>La Magnífica</name>'});
const xml=new DOMParser().parseFromString(generic,'application/xml');
assert.equal(childText(xml,'name'),'Ciclismo al aire libre','reproducción: el método anterior elegía el título genérico de metadata');
// Nuevo comportamiento
assert.equal(parse(generic,'La Magnífica.gpx').name,'La Magnífica','el nombre del track gana sobre el genérico de metadata');
assert.equal(parse(gpx({metadata:'<name>Ciclismo al aire libre</name>'}),'La Magnífica.gpx').name,'La Magnífica','si solo hay un título genérico, se usa el nombre del archivo');
assert.equal(parse(gpx({trk:'<name>Ciclismo al aire libre</name>'}),'Circuito Las Golondrinas.gpx').name,'Circuito Las Golondrinas');
assert.equal(parse(gpx({metadata:'<name>Mountain Biking</name>',trk:'<name>Morning Ride</name>'}),'De Pañhé a Xidhí.gpx').name,'De Pañhé a Xidhí');

// El título interno específico se conserva aunque difiera del archivo (no se pisa lo que la persona nombró).
assert.equal(parse(gpx({trk:'<name>Vuelta a Amealco</name>'}),'export_20260321.gpx').name,'Vuelta a Amealco');
// Sin ningún nombre: el archivo, sin la extensión.
assert.equal(parse(gpx({}),'Ruta sin nombre interno.gpx').name,'Ruta sin nombre interno');
assert.equal(parse(gpx({}),'MAYUSCULAS.GPX').name,'MAYUSCULAS');
// El nombre del autor (metadata/author/name) no es el título de la ruta; el método anterior lo habría usado.
const authored=gpx({metadata:'<author><name>Juan Pérez</name></author>'});
assert.equal(childText(new DOMParser().parseFromString(authored,'application/xml'),'name'),'Juan Pérez','reproducción: el método anterior tomaba el autor');
assert.equal(parse(authored,'Mi ruta.gpx').name,'Mi ruta');
// Todo genérico, incluido el archivo: se queda con el archivo (nunca se inventa un título).
assert.equal(parse(gpx({trk:'<name>Ciclismo al aire libre</name>'}),'activity.gpx').name,'activity');
// Rutas (rte) con prefijo de espacio de nombres distinto.
const rte=`<gpx xmlns="http://www.topografix.com/GPX/1/1"><rte><name>Ruta Sierra Gorda</name><rtept lat="20.5" lon="-100.4"/><rtept lat="20.51" lon="-100.39"/></rte></gpx>`;
assert.equal(parse(rte,'x.gpx').name,'Ruta Sierra Gorda');

// Títulos genéricos de apps vs títulos propios que solo contienen palabras parecidas.
for(const name of ['Ciclismo al aire libre','ciclismo AL AIRE LIBRE','Ciclismo','Morning Ride','Afternoon Ride','Outdoor Cycling','Salida en bici por la tarde','Bicicleta de montaña','Ruta','  ',''])assert.equal(isGenericActivityName(name),true,JSON.stringify(name));
for(const name of ['La Magnífica','Circuito Las Golondrinas','De Pañhé a Xidhí','Ciclismo Sierra Gorda','Ruta del Queso y el Vino','Vuelta a Amealco','Morning Ride to Bernal'])assert.equal(isGenericActivityName(name),false,name);

// El cartel parte de ese nombre y solo lo reemplaza si la persona lo edita.
const activity=parse(generic,'La Magnífica.gpx');
assert.equal(posterData(activity).name,'La Magnífica');assert.equal(posterData(activity,{name:'Título editado'}).name,'Título editado');
console.log('PASS título del GPX: causa raíz reproducida, nombre de track/ruta/metadatos, genérico → archivo, autor ignorado y título editado.');
