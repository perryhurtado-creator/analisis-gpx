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
  target.width=1080;target.height=1620;
  const ctx=target.getContext('2d'),accent=data.level?.color||'#35c77f';
  ctx.fillStyle='#080b0d';ctx.fillRect(0,0,1080,1620);
  // Mapa vertical con su propia proyección: nunca estirar el recorrido.
  const snap=assets.snapshot;
  ctx.save();ctx.beginPath();ctx.rect(540,0,540,1480);ctx.clip();ctx.translate(540,0);
  ctx.drawImage(assets.map,0,0);
  ctx.fillStyle='rgba(255,255,255,.22)';ctx.fillRect(0,0,540,1480);
  for(const [color,width] of [['#fff',11],['#f47724',6]]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();
    for(const run of snap.runs)run.forEach((i,j)=>{const p=snap.positions[i];if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});
    ctx.stroke();
  }
  [snap.positions[0],snap.positions.at(-1)].forEach((p,i)=>{
    ctx.fillStyle=i?'#111':'#25ae76';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
  });
  ctx.fillStyle='rgba(255,255,255,.94)';ctx.fillRect(0,1450,540,30);
  ctx.fillStyle='#243f32';ctx.font='16px Arial';ctx.fillText('© OpenStreetMap contributors',16,1471);ctx.restore();
  // Borde irregular inspirado en el cartel de referencia.
  ctx.fillStyle='#080b0d';ctx.beginPath();ctx.moveTo(520,0);
  for(let y=0;y<=1480;y+=24)ctx.lineTo(540+18*Math.sin(y*.17)+12*Math.cos(y*.07),y);
  ctx.lineTo(500,1480);ctx.lineTo(500,0);ctx.closePath();ctx.fill();
  const logo=assets.logo,ratio=Math.min(410/logo.naturalWidth,350/logo.naturalHeight);
  ctx.drawImage(logo,55+(410-logo.naturalWidth*ratio)/2,24,logo.naturalWidth*ratio,logo.naturalHeight*ratio);
  ctx.fillStyle='#fff';ctx.font='italic 800 32px Arial';ctx.fillText('RUTA MTB',40,422);
  ctx.fillStyle=accent;ctx.fillText('›››',245,422);
  let size=70,lines;
  do{ctx.font=`900 ${size}px Arial`;lines=titleLines(ctx,data.name.toLocaleUpperCase('es-MX'),465);if(lines.length<=4&&lines.every(t=>ctx.measureText(t).width<=465))break;size-=2}while(size>18);
  lines.forEach((line,i)=>{ctx.fillStyle=i===lines.length-1?accent:'#fff';ctx.fillText(line,40,495+i*(size+8))});
  panel(ctx,40,810,455,380,'#101519',22);ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(40,810,455,380,22);ctx.stroke();
  const stats=[['DISTANCIA',data.distance],[data.elevationLabel,data.ascent],['TIEMPO REGISTRADO',data.time]];
  stats.forEach(([label,value],i)=>{
    const y=840+i*120;icon(ctx,i,65,y+14,accent);ctx.fillStyle='#cbd3d8';ctx.font='600 18px Arial';ctx.fillText(label,120,y+22);
    let font=44;do{ctx.font=`800 ${font}px Arial`;if(ctx.measureText(value).width<=345)break;font--}while(font>18);
    ctx.fillStyle='#fff';ctx.fillText(value,120,y+76);
    if(i<2){ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(60,y+98);ctx.lineTo(475,y+98);ctx.stroke()}
  });
  panel(ctx,590,30,450,132,'#101519',12);ctx.fillStyle=accent;ctx.fillRect(590,30,8,132);
  ctx.fillStyle='#fff';ctx.font='italic 800 22px Arial';ctx.fillText('CLASIFICACIÓN MTB',614,65);
  const level=data.level?.label||'Sin clasificar';let levelSize=30;
  do{ctx.font=`800 ${levelSize}px Arial`;if(ctx.measureText(level).width<=400)break;levelSize--}while(levelSize>16);
  ctx.fillStyle=accent;ctx.fillText(level,614,118);
  // Perfil basado en puntos originales, conservando interrupciones.
  ctx.save();ctx.translate(14,120);ctx.scale(.47,1);profile(ctx,source.points,accent);ctx.restore();
  ctx.fillStyle='#bfc9ce';ctx.font='18px Arial';ctx.fillText('Distancia (km)',40,1392);
  ctx.textAlign='right';ctx.fillText(fmt(source.distance/1000)+' km',495,1392);ctx.textAlign='left';
  ctx.fillStyle=accent;ctx.fillRect(40,1500,1000,3);
  ctx.fillStyle='#fff';ctx.font='italic 800 34px Arial';ctx.textAlign='center';ctx.fillText('¡PEDALEA, DISFRUTA, SUPERA TUS LÍMITES!',540,1563);
  ctx.fillStyle='#adb9c1';ctx.font='600 18px Arial';ctx.fillText('PERROS EN BICICLETA · RUTA Y COMUNIDAD',540,1598);ctx.textAlign='left';
}
function options(){return {name:$('posterName')?.value.trim()||activity?.name,level:$('posterLevel')?.value||''}}
function update(){
  revision++;$('downloadPoster').disabled=true;if(!activity)return;
  const data=posterData(activity,options());$('posterMetrics').textContent=`${data.distance} · ${data.ascent} · ${data.time}`;
  $('posterScore').textContent=`Puntos distancia: ${data.distancePts??'—'} · Desnivel: ${data.elevationPts??'—'}. El nivel se elige considerando también terreno, técnica y exposición.`;
  if(resources&&canvas){drawPoster(canvas,activity,data,resources);$('downloadPoster').disabled=false;$('posterStatus').textContent='Cartel listo · 1080 × 1620'}
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
    if(!resources){const snapshot=posterMapSnapshot(selected.points,540,1480,62),map=document.createElement('canvas');map.width=snapshot.width;map.height=snapshot.height;const ctx=map.getContext('2d');ctx.fillStyle='#e6eade';ctx.fillRect(0,0,map.width,map.height);
      const [logo,tiles]=await Promise.all([image(new URL('../assets/logo-perros-en-bicicleta.png',import.meta.url).href,abort.signal),Promise.all(snapshot.tiles.map(async tile=>({...tile,image:await image(tile.url,abort.signal)})))]);
      if(abort.signal.aborted)throw aborted();tiles.forEach(tile=>ctx.drawImage(tile.image,tile.x,tile.y,256,256));resources={logo,map,snapshot};
    }
    canvas=document.createElement('canvas');canvas.className='poster-canvas';canvas.setAttribute('aria-label','Cartel de la ruta con mapa, clasificación y datos');drawPoster(canvas,selected,posterData(selected,options()),resources);canvas.getContext('2d').getImageData(0,0,1,1);
    if(abort.signal.aborted||activity!==selected)throw aborted();$('posterPreview').replaceChildren(canvas);$('posterStatus').textContent='Cartel listo · 1080 × 1620';$('downloadPoster').disabled=false;
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
