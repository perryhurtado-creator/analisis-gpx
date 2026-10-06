import {parseGPX} from './gpx-parser.js';
import {parseTCX} from './tcx-parser.js';
import {avg,fmt,duration,stamp,summary,segments,slopeStats,speedStats,heartZones} from './metrics.js';
import {drawChart} from './charts.js';
import {createMap,fitRoute,showPoint,hidePoint,clearMap} from './map.js';
let videoModule=null;

const $=id=>document.getElementById(id);
let activity=null,compareActivity=null,points=[],resizeObserver=null;
async function getVideoModule(){if(!videoModule)videoModule=await import('./video.js');return videoModule}

function setFileMessage(text,kind=''){$('fileStatus').textContent=text;$('fileStatus').className='file-note '+kind}
function esc(t){return String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function nearest(km){
  const target=km*1000;let lo=0,hi=points.length-1;
  while(lo<hi){const m=(lo+hi)>>1;if(points[m].d<target)lo=m+1;else hi=m}
  const prev=points[Math.max(0,lo-1)],next=points[lo];
  return Math.abs(prev.d-target)<Math.abs(next.d-target)?prev:next;
}
function renderPoster(){
  const box=$('posterData'),preview=$('posterPreview'),status=$('posterStatus'),button=$('makePoster');
  if(!activity){box.innerHTML='<div class="poster-empty"><b>Sin actividad</b><span>Carga primero una ruta desde Resumen.</span></div>';preview.innerHTML='<div class="poster-empty"><b>Aún no hay una ruta cargada</b><span>Sube una actividad desde Resumen para preparar tu cartel.</span></div>';status.textContent='Esperando ruta';button.disabled=true;return}
  const km=activity.distance/1000, d=activity.ascent;
  const distancePts=km<=15?1:km<=25?2:km<=40?3:km<=60?4:km<=80?5:6;
  const elevationPts=d<=200?1:d<=500?2:d<=900?3:d<=1400?4:d<=2000?5:6;
  box.innerHTML=`<div class="poster-route-name">${esc(activity.name)}</div><div class="poster-grid"><div><span>Distancia</span><b>${fmt(km)} km</b></div><div><span>Desnivel +</span><b>${fmt(d)} m</b></div><div><span>Puntos distancia</span><b>${distancePts}</b></div><div><span>Puntos desnivel</span><b>${elevationPts}</b></div></div><div class="poster-note">La clasificación final utilizará también terreno/técnica, calor/exposición y duración según el sistema oficial.</div>`;
  preview.innerHTML=`<div class="poster-card"><div class="poster-card-top">PERROS EN BICICLETA</div><div class="poster-card-map">Ruta cargada</div><div class="poster-card-title">${esc(activity.name)}</div><div class="poster-card-stats"><span>${fmt(km)} km</span><span>+${fmt(d)} m</span><span>${duration(activity.duration)}</span></div><div class="poster-card-level">CLASIFICACIÓN MTB</div></div>`;
  status.textContent='Ruta preparada';button.disabled=false;
}
function navigate(hash){
  const id=(hash||'#resumen').replace('#','');
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active-page',p.id===id));
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id));
  const titles={resumen:'Resumen',video:'Generar vídeo',cartel:'Elabora tu cartel',trazar:'Traza una ruta'};
  $('pageTitle').textContent=titles[id]||'Resumen';
  if(id==='cartel')renderPoster();
  if(id==='video'&&activity)getVideoModule().then(v=>v.prepareVideoMap(points)).catch(e=>console.error('Video module:',e));
  window.scrollTo({top:0,behavior:'smooth'});
}
function render(){
  const a=activity,hrs=points.map(p=>p.hr).filter(Number.isFinite),cads=points.map(p=>p.cad).filter(Number.isFinite);
  const speeds=points.map(p=>p.speed).filter(Number.isFinite),eles=points.map(p=>p.ele).filter(Number.isFinite),km=a.distance/1000;
  const avgs=a.duration?km/(a.duration/3600000):avg(speeds);
  const slopes=slopeStats(points),speed=speedStats(points),zones=heartZones(points),maxSpeed=speed.max,avgSpeed=avgs;
  $('analysis').style.display='block';$('routeName').textContent=a.name;
  $('routeMeta').textContent=`${a.type} · ${points.length.toLocaleString('es-MX')} puntos${a.start?' · '+stamp(a.start):''}`;
  const cards=[['Distancia',fmt(km)+' km',''],['Tiempo',duration(a.duration),''],['Velocidad media',avgs?fmt(avgs)+' km/h':'—',''],['Desnivel +','+'+fmt(a.ascent)+' m','accent'],['FC media',hrs.length?Math.round(avg(hrs))+' lpm':'—',''],['Cadencia',cads.length?Math.round(avg(cads))+' rpm':'—','']];
  $('metrics').innerHTML=cards.map(c=>`<div class="metric ${c[2]}"><div class="k">${c[0]}</div><div class="v">${c[1]}</div><div class="sub"></div></div>`).join('');
  $('details').innerHTML=`<div class="detail-block"><div class="detail-label">Archivo</div><div class="detail-value">${esc(a.file)}</div><div class="detail-muted">${a.type} · análisis local</div></div>
    <div class="detail-block"><div class="detail-label">Altitud</div><div class="detail-value">${eles.length?fmt(Math.min(...eles))+' – '+fmt(Math.max(...eles))+' m':'No disponible'}</div><div class="detail-muted">Desnivel − ${fmt(a.descent)} m</div></div>
    <div class="detail-block"><div class="detail-label">Motor de mapa</div><div class="engine" id="engine"><span class="tag">Iniciando</span></div><div class="detail-muted">Ruta y gráficas sincronizadas</div></div>`;
  drawChart('elevationChart',points.map(p=>[p.d/1000,p.ele]),'#2a9b69','Altitud (m)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  $('elevationStats').innerHTML=`<table><thead><tr><th>Pendiente máx. +</th><th>Pendiente máx. −</th><th>Pendiente media</th></tr></thead><tbody><tr><td>${slopes.maxUp!==null?fmt(slopes.maxUp)+' %':'—'}</td><td>${slopes.maxDown!==null?fmt(slopes.maxDown)+' %':'—'}</td><td>${slopes.avgUp!==null?fmt(slopes.avgUp)+' %':'—'}</td></tr></tbody></table>`;
  drawChart('heartChart',points.map(p=>[p.d/1000,p.hr]),'#ee5c73','Frecuencia cardiaca (lpm)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  $('heartStats').innerHTML=zones.length?`<table><thead><tr><th>Zona</th><th>Rango</th><th>Tiempo</th></tr></thead><tbody>${zones.map(z=>`<tr><td>Z${z.zone}</td><td>${Math.round(z.min)}–${Math.round(z.max)} lpm</td><td>${duration(z.time)}</td></tr>`).join('')}</tbody></table>`:'<div class="chart-empty">No hay datos de tiempo y frecuencia cardiaca suficientes.</div>'; 
  drawChart('speedChart',points.map(p=>[p.d/1000,p.speed]),'#397de8','Velocidad (km/h)',k=>{const p=nearest(k);showPoint(p);return p},hidePoint);
  $('speedStats').innerHTML=`<table><thead><tr><th>Velocidad máxima</th><th>Velocidad media</th></tr></thead><tbody><tr><td>${maxSpeed!==null?fmt(maxSpeed)+' km/h':'—'}</td><td>${avgSpeed!==null?fmt(avgSpeed)+' km/h':'—'}</td></tr></tbody></table>`;
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
  if(videoModule)videoModule.stopRouteAnimation();clearMap();activity=null;compareActivity=null;points=[];
  $('analysis').style.display='none';$('metrics').innerHTML='';$('details').innerHTML='';$('segments').innerHTML='';
  $('elevationChart').innerHTML='';$('heartChart').innerHTML='';$('speedChart').innerHTML='';$('elevationStats').innerHTML='';$('heartStats').innerHTML='';$('speedStats').innerHTML='';
  $('compareBody').innerHTML='';$('compareTable').hidden=true;$('compareState').textContent='Aún no has elegido una segunda ruta.';$('compareInput').value='';
  $('routeName').textContent='Actividad';$('routeMeta').textContent='Archivo analizado localmente';
  renderPoster();
  $('mapStatus').textContent='Preparando mapa';$('videoState').textContent='Listo para animar tu recorrido.';$('playRoute').textContent='▷ Reproducir';
  setFileMessage('Sin actividad cargada todavía.');
}
function choose(){$('fileInput').click()}

$('chooseFile').onclick=e=>{e.preventDefault();choose()};$('topLoad').onclick=()=>{resetActivity();location.hash='resumen';choose()};$('sideLoad').onclick=()=>{resetActivity();location.hash='resumen';choose()};
$('fileInput').onchange=()=>loadFile($('fileInput').files[0]);$('compareLoad').onclick=()=>$('compareInput').click();$('compareInput').onchange=()=>loadCompare($('compareInput').files[0]);
$('playRoute').onclick=async()=>{if(!activity)return;try{const v=await getVideoModule();v.prepareVideoMap(points);v.playRoute(points)}catch(e){console.error(e);$('videoState').textContent='No se pudo iniciar la reproducción.'}};
$('makeVideo').onclick=async()=>{if(!activity)return;try{const v=await getVideoModule();v.prepareVideoMap(points);v.makeVideo(activity)}catch(e){console.error(e);$('videoState').textContent='No se pudo iniciar la generación del vídeo.'}};$('fitRoute').onclick=()=>fitRoute(points);
['dragenter','dragover'].forEach(t=>$('dropZone').addEventListener(t,e=>{e.preventDefault();$('dropZone').classList.add('over')}));
['dragleave','drop'].forEach(t=>$('dropZone').addEventListener(t,e=>{e.preventDefault();$('dropZone').classList.remove('over')}));
$('dropZone').addEventListener('drop',e=>loadFile(e.dataTransfer.files[0]));
window.addEventListener('error',e=>console.error('App error:',e.error||e.message));

window.addEventListener('hashchange',()=>navigate(location.hash));
document.querySelectorAll('.nav a').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();location.hash=a.getAttribute('href').slice(1)}));
$('makePoster').onclick=()=>{if(!activity)return; $('posterStatus').textContent='Cartel preparado para la siguiente etapa de diseño.'};
navigate(location.hash||'#resumen');
