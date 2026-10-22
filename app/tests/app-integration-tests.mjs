import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const dom=new JSDOM(readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'https://app.test/#resumen',pretendToBeVisual:true});
for(const key of ['window','document','DOMParser','location','FileReader','Event','File'])globalThis[key]=dom.window[key];
window.scrollTo=()=>{};globalThis.requestAnimationFrame=window.requestAnimationFrame.bind(window);globalThis.cancelAnimationFrame=window.cancelAnimationFrame.bind(window);
const marker=()=>({addTo(){return this},bindTooltip(){return this},setLatLng(){return this},setOpacity(){return this}});
window.L={map:()=>({remove(){},fitBounds(){},invalidateSize(){}}),tileLayer:()=>({on(){return this},addTo(){return this}}),polyline:()=>({}),featureGroup:()=>({addTo(){return this}}),circleMarker:marker,marker,icon:x=>x,latLngBounds:x=>x};
await import('../js/app.js');const $=id=>document.getElementById(id);
async function load(text,name,id='fileInput'){
  Object.defineProperty($(id),'files',{configurable:true,value:[new File([text],name)]});$(id).onchange();
  for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,5));if(id==='fileInput'?!/Leyendo/.test($('fileStatus').textContent):!/Analizando/.test($('compareState').textContent))return}
  throw Error('La carga no terminó');
}
const gpx=heights=>'<gpx><trk><name>Auditoría &lt;b&gt;</name><trkseg>'+heights.map((e,i)=>`<trkpt lat="20" lon="${-100+i*.0001}">${e===null?'':`<ele>${e}</ele>`}<time>${new Date(1700000000000+i*10000).toISOString()}</time><extensions><hr>160</hr></extensions></trkpt>`).join('')+'</trkseg></trk></gpx>';
await load(gpx([null,null,null]),'ausente.gpx');assert.match($('fileStatus').textContent,/correctamente/);assert.match($('metrics').textContent,/Sin datos/);assert(!$('metrics').textContent.includes('+0 m'));assert.equal($('explorerAscent').textContent,'—');assert.match($('heartStats').textContent,/Configura/);assert.equal($('routeName').textContent,'Auditoría <b>');assert(!$('routeName').querySelector('b'));
$('heartMax').value='202';$('heartMax').dispatchEvent(new Event('change'));assert.match($('heartStats').textContent,/202 lpm/);assert.equal($('heartStats').querySelectorAll('tbody tr').length,5);
await load(gpx([300,290,null,260,250,240,230,220]),'parcial.gpx');$('explorerSeek').value='1000';$('explorerSeek').dispatchEvent(new Event('input'));assert.match($('details').textContent,/−20 m \(parcial\)/);assert.equal($('explorerDescent').textContent,'−20 m (parcial)');
const tcx='<TrainingCenterDatabase><Activities><Activity><Lap><Track>'+[0,1,2].map(i=>`<Trackpoint><Time>${new Date(1700000000000+i*10000).toISOString()}</Time><Position><LatitudeDegrees>20</LatitudeDegrees><LongitudeDegrees>${-100+i*.0001}</LongitudeDegrees></Position><DistanceMeters>${i*100}</DistanceMeters><Extensions><Speed>${10}</Speed></Extensions></Trackpoint>`).join('')+'</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
await load(tcx,'sensor.tcx');await load(tcx,'comparada.tcx','compareInput');assert.match($('metrics').textContent,/36 km\/h/);assert.equal($('compareBody').querySelectorAll('tr')[2].children[1].textContent,'36 km/h');assert.equal($('compareBody').querySelectorAll('tr')[2].children[2].textContent,'36 km/h');
const previous=$('routeName').textContent;await load('<gpx>','invalida.gpx');assert.equal($('routeName').textContent,previous);assert.match($('fileStatus').textContent,/XML válido/);
dom.window.close();console.log('PASS integración DOM: GPX/TCX, ausencia/parcialidad, acumulados, zonas personales, comparación, texto seguro y conservación tras XML inválido.');
