import {posterData,posterMapSnapshot,POSTER_LEVELS,posterRuns} from './poster-data.js';
import {fmt} from './metrics.js';
const $=id=>document.getElementById(id);
let activity=null,controller=null,resources=null,canvas=null,revision=0;
function aborted(){return new DOMException('Cartel cancelado.','AbortError')}
function image(url,signal){
  return new Promise((resolve,reject)=>{
    const img=new Image();img.crossOrigin='anonymous';
    const done=error=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);img.onload=img.onerror=null;error?reject(error):resolve(img)};
    const cancel=()=>{done(aborted());img.src=''};
    const timer=setTimeout(()=>{done(Error('No se pudo cargar el mapa o el logo. Revisa tu conexión e inténtalo de nuevo.'));img.src=''},20000);
    img.onload=()=>done();img.onerror=()=>done(Error('No se pudo cargar el mapa o el logo. Revisa tu conexión e inténtalo de nuevo.'));
    signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return}img.src=url;
  });
}
function panel(ctx,x,y,w,h,color,r=18){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
function titleLines(ctx,text,width){
  const lines=[];let line='';
  for(const original of text.split(/\s+/)){
    const parts=[];let part='';for(const letter of original){if(part&&ctx.measureText(part+letter).width>width){parts.push(part);part=letter}else part+=letter}if(part)parts.push(part);
    for(const word of parts){const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>width){lines.push(line);line=word}else line=next}
  }
  if(line)lines.push(line);return lines;
}
function profile(ctx,points,accent){
  const values=points.map(p=>p.ele).filter(Number.isFinite);ctx.fillStyle='#a4b5ac';ctx.font='600 19px Arial';ctx.fillText('PERFIL DE ELEVACIÓN',54,1153);
  if(!values.length){ctx.font='22px Arial';ctx.fillText('Esta ruta no incluye altitudes.',54,1205);return}
  const {min,max}=values.reduce((b,v)=>({min:Math.min(b.min,v),max:Math.max(b.max,v)}),{min:Infinity,max:-Infinity});
  const distance=points.at(-1).d||1;ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.beginPath();
  for(const run of posterRuns(points)){let previous=false;for(const i of run){const p=points[i];if(!Number.isFinite(p.ele)){previous=false;continue}const x=54+p.d/distance*972,y=1236-(p.ele-min)/(max-min||1)*55;if(previous)ctx.lineTo(x,y);else ctx.moveTo(x,y);previous=true}}
  ctx.stroke();ctx.strokeStyle='#345045';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(54,1246);ctx.lineTo(1026,1246);ctx.stroke();ctx.fillStyle='#a4b5ac';ctx.font='18px Arial';ctx.fillText(`${fmt(min,0)}–${fmt(max,0)} m`,800,1153);
}
function icon(ctx,type,x,y,accent){
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  if(type===0){ctx.moveTo(0,24);ctx.lineTo(8,8);ctx.lineTo(19,23);ctx.lineTo(30,0);ctx.stroke();for(const p of [[0,24],[30,0]]){ctx.beginPath();ctx.arc(...p,4,0,Math.PI*2);ctx.stroke()}}
  else if(type===1){ctx.moveTo(0,25);ctx.lineTo(14,1);ctx.lineTo(30,25);ctx.closePath();ctx.moveTo(9,10);ctx.lineTo(14,14);ctx.lineTo(19,10);ctx.stroke()}
  else{ctx.arc(15,14,14,0,Math.PI*2);ctx.moveTo(15,5);ctx.lineTo(15,14);ctx.lineTo(22,18);ctx.stroke()}ctx.restore();
}
export function drawPoster(target,source,data,assets){
  target.width=1080;target.height=1350;const ctx=target.getContext('2d'),accent=data.level?.color||'#35c77f';
  ctx.fillStyle='#101e19';ctx.fillRect(0,0,1080,1350);
  ctx.fillStyle=accent;ctx.fillRect(0,0,12,1350);ctx.fillStyle='#1b3228';ctx.beginPath();ctx.moveTo(620,0);ctx.lineTo(1080,0);ctx.lineTo(1080,450);ctx.closePath();ctx.fill();
  ctx.fillStyle=accent;ctx.font='800 23px Arial';ctx.fillText('PERROS EN BICICLETA',54,81);ctx.fillStyle='#a4b5ac';ctx.font='600 19px Arial';ctx.fillText('RUTAS MTB',54,115);
  // Archivo original, completo y escalado con la misma relación de aspecto.
  const logo=assets.logo,ratio=Math.min(220/logo.naturalWidth,286/logo.naturalHeight);ctx.drawImage(logo,788+(220-logo.naturalWidth*ratio)/2,10,logo.naturalWidth*ratio,logo.naturalHeight*ratio);
  let size=76,lines;do{ctx.font=`900 ${size}px Arial`;lines=titleLines(ctx,data.name,710);if(lines.length<=3&&lines.every(t=>ctx.measureText(t).width<=710))break;size-=2}while(size>18);
  ctx.fillStyle='#f8faf5';lines.forEach((line,i)=>ctx.fillText(line,54,206+i*(size+10)));
  panel(ctx,54,425,972,65,data.level?'#213b2e':'#1c3027');ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(54,425,972,65,18);ctx.stroke();
  ctx.fillStyle=data.level?.label.startsWith('Negra')?'#050807':accent;ctx.beginPath();ctx.arc(84,458,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c5d4cb';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#f8faf5';ctx.font='700 29px Arial';ctx.fillText(data.level?data.level.label:'Ruta MTB · Sin clasificar',110,468);
  ctx.fillStyle='#a4b5ac';ctx.font='600 19px Arial';ctx.fillText('RECORRIDO REAL',54,518);
  ctx.save();ctx.beginPath();ctx.roundRect(54,534,972,400,18);ctx.clip();ctx.translate(54,534);ctx.drawImage(assets.map,0,0);
  const snap=assets.snapshot;for(const [color,width] of [['#fff',9],[data.level?.label.startsWith('Negra')?'#111':accent,5]]){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();for(const run of snap.runs)run.forEach((i,j)=>{const p=snap.positions[i];if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});ctx.stroke()}
  [snap.positions[0],snap.positions.at(-1)].forEach((p,i)=>{ctx.fillStyle=i?'#f56c67':'#25ae76';ctx.beginPath();ctx.arc(p.x,p.y,7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke()});
  ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(0,371,972,29);ctx.fillStyle='#243f32';ctx.font='16px Arial';ctx.fillText('© OpenStreetMap contributors',12,391);ctx.fillStyle='#25ae76';ctx.beginPath();ctx.arc(793,385,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#243f32';ctx.fillText('Inicio',805,391);ctx.fillStyle='#f56c67';ctx.beginPath();ctx.arc(882,385,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#243f32';ctx.fillText('Final',894,391);ctx.restore();
  const stats=[['DISTANCIA',data.distance],[data.elevationLabel,data.ascent],['TIEMPO REGISTRADO',data.time]];
  stats.forEach(([label,value],i)=>{const x=54+i*330;panel(ctx,x,968,312,135,'#1d332a');icon(ctx,i,x+20,987,accent);ctx.fillStyle='#a4b5ac';ctx.font='600 16px Arial';ctx.fillText(label,x+65,1008);let font=39;do{ctx.font=`800 ${font}px Arial`;if(ctx.measureText(value).width<=274)break;font--}while(font>18);ctx.fillStyle='#f8faf5';ctx.fillText(value,x+20,1072)});
  profile(ctx,source.points,accent);ctx.fillStyle='#a4b5ac';ctx.font='600 18px Arial';ctx.fillText('PERROS EN BICICLETA',54,1300);ctx.textAlign='right';ctx.fillText('MTB · RUTA Y COMUNIDAD',1026,1300);ctx.textAlign='left';
}
function options(){return {name:$('posterName')?.value.trim()||activity?.name,level:$('posterLevel')?.value||''}}
function update(){
  revision++;$('downloadPoster').disabled=true;if(!activity)return;
  const data=posterData(activity,options());$('posterMetrics').textContent=`${data.distance} · ${data.ascent} · ${data.time}`;
  $('posterScore').textContent=`Puntos distancia: ${data.distancePts??'—'} · Desnivel: ${data.elevationPts??'—'}. El nivel se elige considerando también terreno, técnica y exposición.`;
  if(resources&&canvas){drawPoster(canvas,activity,data,resources);$('downloadPoster').disabled=false;$('posterStatus').textContent='Cartel listo · 1080 × 1350'}
  else $('posterStatus').textContent='Personaliza los datos y genera tu cartel';
}
function empty(){const div=document.createElement('div');div.className='poster-empty';const b=document.createElement('b');b.textContent='Aún no hay una ruta cargada';const span=document.createElement('span');span.textContent='Sube una actividad desde Resumen para preparar tu cartel.';div.append(b,span);return div}
export function setPosterActivity(next){
  if(next===activity)return;
  controller?.abort();controller=null;revision++;activity=next;resources=null;canvas=null;
  $('posterPreview').replaceChildren(empty());$('posterData').replaceChildren();$('makePoster').disabled=!next;$('downloadPoster').disabled=true;
  if(!next){$('posterStatus').textContent='Esperando ruta';return}
  $('posterData').innerHTML='<label class="poster-field">Nombre de la ruta<input id="posterName" maxlength="140" type="text"></label><label class="poster-field">Clasificación MTB<select id="posterLevel"><option value="">Sin clasificar</option></select></label><p id="posterMetrics" class="poster-route-name"></p><p id="posterScore" class="poster-note"></p><p class="poster-note">El tiempo procede del archivo. Los datos ausentes aparecen como “Sin datos”.</p>';
  $('posterName').value=next.name.slice(0,140);for(const [value,level] of Object.entries(POSTER_LEVELS)){const opt=document.createElement('option');opt.value=value;opt.textContent=level.label;$('posterLevel').appendChild(opt)}
  $('posterName').addEventListener('input',update);$('posterLevel').addEventListener('change',update);update();$('posterPreview').firstChild.querySelector('b').textContent='Tu cartel aparecerá aquí';$('posterPreview').firstChild.querySelector('span').textContent='Elige el nombre y la clasificación, y pulsa Generar cartel.';
}
export async function generatePoster(){
  if(!activity||controller)return;
  const selected=activity,abort=new AbortController();controller=abort;const fields=[$('posterName'),$('posterLevel')];fields.forEach(e=>e.disabled=true);$('makePoster').disabled=true;$('downloadPoster').disabled=true;
  try{
    $('posterStatus').textContent='Cargando mapa real y logo…';
    if(!resources){const snapshot=posterMapSnapshot(selected.points),map=document.createElement('canvas');map.width=snapshot.width;map.height=snapshot.height;const ctx=map.getContext('2d');ctx.fillStyle='#e6eade';ctx.fillRect(0,0,map.width,map.height);
      const [logo,tiles]=await Promise.all([image(new URL('../assets/logo-perros-en-bicicleta.png',import.meta.url).href,abort.signal),Promise.all(snapshot.tiles.map(async tile=>({...tile,image:await image(tile.url,abort.signal)})))]);
      if(abort.signal.aborted)throw aborted();tiles.forEach(tile=>ctx.drawImage(tile.image,tile.x,tile.y,256,256));resources={logo,map,snapshot};
    }
    canvas=document.createElement('canvas');canvas.className='poster-canvas';canvas.setAttribute('aria-label','Cartel de la ruta con mapa, clasificación y datos');drawPoster(canvas,selected,posterData(selected,options()),resources);canvas.getContext('2d').getImageData(0,0,1,1);
    if(abort.signal.aborted||activity!==selected)throw aborted();$('posterPreview').replaceChildren(canvas);$('posterStatus').textContent='Cartel listo · 1080 × 1350';$('downloadPoster').disabled=false;
  }catch(e){if(activity===selected)$('posterStatus').textContent=e.name==='AbortError'?'Generación cancelada.':e.message;abort.abort()}
  finally{if(controller===abort){controller=null;$('makePoster').disabled=!activity;fields.forEach(e=>e.disabled=false)}}
}
export async function downloadPoster(){
  if(!canvas||!activity||controller)return;
  const selected=activity,version=revision,name=options().name;$('downloadPoster').disabled=true;
  try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('No se pudo guardar el cartel.');if(activity!==selected||revision!==version)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(name||'ruta').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'_cartel.png';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('posterStatus').textContent='Cartel PNG descargado.'}
  catch(e){if(activity===selected)$('posterStatus').textContent=e.message}
  finally{if(activity===selected&&canvas&&!controller)$('downloadPoster').disabled=false}
}
