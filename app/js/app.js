import {parseGPX} from './gpx-parser.js';
import {parseTCX} from './tcx-parser.js';
import {avg,fmt,duration,stamp,summary,segments} from './metrics.js';
import {drawChart} from './charts.js';
import {createMap,fitRoute,showPoint,hidePoint,clearMap} from './map.js';
import {playRoute,makeVideo,stopRouteAnimation} from './video.js';

const $=id=>document.getElementById(id);
let activity=null,compareActivity=null,points=[],resizeObserver=null;

function setFileMessage(text,kind=''){$('fileStatus').textContent=text;$('fileStatus').className='file-note '+kind}
function esc(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function nearest(km){
  const target=km*1000;let lo=0,hi=points.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(points[m].d<target)lo=m+1;else hi=m}
  const prev=points[Math.max(0,lo-1)],next=points[lo];
  return Math.abs(prev.d-target)<Math.abs(next.d-target)?prev:next;
}
function render(){
  const a=activity,hrs=points.map(p=>p.hr).filter(Number.isFinite),cads=points.map(p=>p.cad).filter(Number.isFinite);
  const speeds=points.map(p=>p.speed).filter(Number.isFinite),eles=points.map(p=>p.ele).filter(Number.isFinite),km=a.distance/1000;
  const avgs=a.duration?km/(a.duration/3600000):avg(speeds);
  $('analysis').style.display='block';$('routeName').textContent=a.name;
  $('routeMeta').textContent=`${a.type} · ${points.length.toLocaleString('es-MX')} puntos${a.start?' · '+stamp(a.start):''}`;
  const cards=[['Distancia',fmt(km)+' km',''],['Tiempo',duration(a.duration),''],['Velocidad media',avgs?fmt(avgs)+' km/h':'—',''],['Desnivel +','+'+fmt(a.ascent)+' m','accent'],['FC media',hrs.length?Math.round(avg(hrs))+' lpm':'—',''],['Cadencia',cads.length?Math.round(avg(cads))+' rpm':'—','']];
  $('metrics').innerHTML=cards.map(c=>`<div class="metric ${c[2]}"><div class="k">${c[0]}</div><div class="v">${c[1]}</div><div class="sub"></div></div>`).join('');
  $('details').innerHTML=`<div class="detail-block"><div class="detail-label">Archivo</div><div class="detail-value">${esc(a.file)}</div><div class="detail-muted">${a.type} · análisis local</div></div>
    <div class="detail-block"><div class="detail-label">Altitud</div><div class="detail-value">${eles.length?fmt(Math.min(...eles))+' – '+fmt(Math.max(...eles))+' m':'No disponible'}</div><div class="detail-muted">Desnivel − ${fmt(a.descent)} m</div></div>
    <div class="detail-block"><div class="detail-label">Motor de mapa</div><div class="engine" id="engine"><span class="tag">Iniciando</span></div><div class="detail-muted">Ruta y gráficas sincronizadas</div></div>`;
  drawChart('elevationChart',points.map(p=>[p.d/1000,p.ele]),'#2a9b69','Altitud (m)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  drawChart('heartChart',points.map(p=>[p.d/1000,p.hr]),'#ee5c73','Frecuencia cardiaca (lpm)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  drawChart('speedChart',points.map(p=>[p.d/1000,p.speed]),'#397de8','Velocidad (km/h)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  renderSegments();if(compareActivity)renderComparison();createMap(points);
}
function renderSegments(){
  const rows=segments(activity);
  $('segments').innerHTML=rows.map(r=>`<tr><td><span class="seg-bullet"></span>Tramo ${r.index}</td><td>${fmt(r.distance)} km</td><td>${duration(r.time)}</td><td>${r.speed?fmt(r.speed)+' km/h':'—'}</td><td>+${fmt(r.up)} m</td><td>${r.hr?Math.round(r.hr)+' lpm':'—'}</td><td>${r.cad?Math.round(r.cad)+' rpm':'—'}</td></tr>`).join('')||'<tr><td colspan="7">No hay suficientes datos para calcular segmentos.</td></tr>';
}
function renderComparison(){
  if(!activity||!compareActivity)return;
  const one=summary(activity),two=summary(compareActivity);
  const rows=[['Distancia','distance'],['Tiempo','time'],['Velocidad media','speed'],['Desnivel positivo','ascent'],['FC media','heart'],['Cadencia media','cadence']];
  $('mainRouteHeader').textContent=activity.name;$('compareRouteHeader').textContent=compareActivity.name;
  $('compareBody').innerHTML=rows.map(r=>`<tr><td>${r[0]}</td><td>${one[r[1]]}</td><td>${two[r[1]]}</td></tr>`).join('');
  $('compareTable').hidden=false;
}
function readFile(file,callback){
  if(!file)return;
  if(!/\.(gpx|tcx)$/i.test(file.name)){callback(null,Error('Selecciona un archivo GPX o TCX.'));return}
  const reader=new FileReader();reader.onerror=()=>callback(null,Error('No se pudo leer este archivo.'));
  reader.onload=()=>{try{const text=String(reader.result),parsed=/\.tcx$/i.test(file.name)?parseTCX(text,file.name):parseGPX(text,file.name);callback(parsed,null)}catch(e){callback(null,e)}};
  reader.readAsText(file);
}
function loadFile(file){
  if(!file)return;setFileMessage('Leyendo '+file.name+'…');
  readFile(file,(parsed,error)=>{if(error){console.error(error);setFileMessage(error.message||'No fue posible analizar el archivo.','error');return}activity=parsed;points=parsed.points;render();setFileMessage('Actividad cargada correctamente.','ok')});
}
function loadCompare(file){
  if(!file)return;$('compareState').textContent='Analizando '+file.name+'…';
  readFile(file,(parsed,error)=>{if(error){console.error(error);$('compareState').textContent=error.message||'No fue posible analizar la ruta.';return}compareActivity=parsed;renderComparison();$('compareState').textContent='Ruta cargada: '+parsed.name});
}
function resetActivity(){
  stopRouteAnimation();clearMap();activity=null;compareActivity=null;points=[];
  $('analysis').style.display='none';$('metrics').innerHTML='';$('details').innerHTML='';$('segments').innerHTML='';
  $('elevationChart').innerHTML='';$('heartChart').innerHTML='';$('speedChart').innerHTML='';
  $('compareBody').innerHTML='';$('compareTable').hidden=true;$('compareState').textContent='Aún no has elegido una segunda ruta.';$('compareInput').value='';
  $('routeName').textContent='Actividad';$('routeMeta').textContent='Archivo analizado localmente';
  $('mapStatus').textContent='Preparando mapa';$('videoState').textContent='Listo para animar tu recorrido.';$('playRoute').textContent='▷ Reproducir';
  setFileMessage('Sin actividad cargada todavía.');
}
function choose(){$('fileInput').click()}

$('chooseFile').onclick=e=>{e.preventDefault();choose()};$('topLoad').onclick=()=>{resetActivity();choose()};$('sideLoad').onclick=()=>{resetActivity();choose()};
$('fileInput').onchange=()=>loadFile($('fileInput').files[0]);$('compareLoad').onclick=()=>$('compareInput').click();$('compareInput').onchange=()=>loadCompare($('compareInput').files[0]);
$('playRoute').onclick=()=>activity&&playRoute(points);$('makeVideo').onclick=()=>activity&&makeVideo(activity);$('fitRoute').onclick=()=>fitRoute(points);
['dragenter','dragover'].forEach(t=>$('dropZone').addEventListener(t,e=>{e.preventDefault();$('dropZone').classList.add('over')}));
['dragleave','drop'].forEach(t=>$('dropZone').addEventListener(t,e=>{e.preventDefault();$('dropZone').classList.remove('over')}));
$('dropZone').addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
$('settingsLink').onclick=()=>{$('configuracion').classList.toggle('visible');$('tokenInput').focus()};
$('tokenInput').value=localStorage.getItem('pb-mapbox-token')||'';
$('saveToken').onclick=()=>{
  const token=$('tokenInput').value.trim(),status=$('tokenStatus');
  if(token&&!token.startsWith('pk.')){status.textContent='Usa un token público de Mapbox que empiece por pk.';status.className='status error';return}
  localStorage.setItem('pb-mapbox-token',token);
  status.textContent=token?'Token guardado. El mapa se actualizará.':'Token eliminado. Se usará el mapa de respaldo.';
  status.className='status ok';if(activity)createMap(points);
};

window.addEventListener('error',e=>console.error('App error:',e.error||e.message));
