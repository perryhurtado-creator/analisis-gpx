import {createPosterTask} from './poster-task.js';
import {TITLE_FONTS,ensureTitleFont} from './poster-fonts.js';
import {posterData,posterMapSnapshot,POSTER_LEVELS,posterRuns} from './poster-data.js';
import {fmt} from './metrics.js';
import {posterLocalities} from './poster-localities.js';
import {parseManualLocalities,manualPosterLocalities,mergeManualLabels} from './poster-manual-localities.js';
import {placeLocalityLabels,posterBlockedRects,orderLocalityLabels} from './locality-selection.js';
const $=id=>document.getElementById(id);
let activity=null,controller=null,resources=null,canvas=null,revision=0,manualText='';
function aborted(){return new DOMException('Cartel cancelado.','AbortError')}
function image(url,signal){
  return new Promise((resolve,reject)=>{
    const img=new Image();img.crossOrigin='anonymous';img.referrerPolicy='origin';
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
  const manualWarnings=[];
  target.width=1080;target.height=1620;
  const ctx=target.getContext('2d'),accent=data.level?.color||'#35c77f',snap=assets.snapshot;
  ctx.fillStyle='#080b0d';ctx.fillRect(0,0,1080,1620);
  // El mapa es el fondo completo. No se deforma la geometría GPX.
  ctx.drawImage(assets.map,0,0);
  // No oscurecer el mapa completo: solo los paneles llevan fondo.
  // Doble contorno de alto contraste: negro exterior, blanco separador y color central.
  const routeColor=data.level?.label?.startsWith('Negra')?'#f5d64b':accent;
  for(const [color,width] of [['#111820',18],['#fff',13],[routeColor,8]]){
    ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineJoin=ctx.lineCap='round';ctx.beginPath();
    for(const run of snap.runs)run.forEach((i,j)=>{const p=snap.positions[i];if(j)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y)});
    ctx.stroke();
  }
  [snap.positions[0],snap.positions.at(-1)].forEach((p,i)=>{
    if(!p)return;ctx.fillStyle=i?'#161a1d':'#23b978';ctx.beginPath();ctx.arc(p.x,p.y,11,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#fff';ctx.lineWidth=3;ctx.stroke();
  });
  // Nombres de poblaciones del catálogo o de la consulta por área.
  if(data.showLocalities&&Array.isArray(assets.localities)){
    ctx.font='bold 19px Arial';ctx.textAlign='left';
    // Prioridad por importancia; las sustitutas cubren las que no caben sin chocar con paneles.
    const ordered=orderLocalityLabels(assets.localities,assets.localitySpares);
    const {placed,dropped}=placeLocalityLabels(ordered,snap.positions,text=>ctx.measureText(text).width,posterBlockedRects(data),{max:ordered.some(p=>p.manual)?12:7});
    for(const entry of dropped)if(ordered.some(p=>p.manual&&p.name===entry.name))manualWarnings.push(`No hay espacio visible para «${entry.name}»; prueba ocultar el perfil o las recomendaciones.`);
    for(const {name,x,y,w,dot} of placed){
      panel(ctx,x,y,w,35,'rgba(0,0,0,.87)',7);
      ctx.fillStyle='#fff';ctx.fillText(name,x+11,y+24,w-22);
      ctx.fillStyle=routeColor;ctx.beginPath();ctx.arc(dot.x,dot.y,5,0,Math.PI*2);ctx.fill();
    }
  }
  // Paneles compactos: la ruta permanece visible en el centro del cartel.
  // Logo sin recuadro: se dibuja directamente el PNG original sobre el mapa.
  const logo=assets.logo,ratio=Math.min(284/logo.naturalWidth,265/logo.naturalHeight);
  ctx.drawImage(logo,0+(284-logo.naturalWidth*ratio)/2,0,logo.naturalWidth*ratio,logo.naturalHeight*ratio);
  panel(ctx,270,22,490,160,'rgba(3,8,12,.87)',14);
  ctx.fillStyle='#fff';ctx.font='italic 800 23px Arial, sans-serif';ctx.fillText('RUTA MTB',290,53);
  let size=52,lines;do{
    const chosen=TITLE_FONTS[data.titleFont]||TITLE_FONTS.blackops;
    ctx.font=chosen.weight+' '+size+'px '+(data.titleFontReady?'"'+chosen.family+'"':'Arial, sans-serif');lines=titleLines(ctx,data.name.toLocaleUpperCase('es-MX'),445);
    if(lines.length<=2&&lines.every(t=>ctx.measureText(t).width<=445))break;size-=2;
  }while(size>18);
  lines.slice(0,2).forEach((line,i)=>{ctx.fillStyle=i===lines.length-1?accent:'#fff';ctx.fillText(line,290,110+i*(size+7))});
  panel(ctx,775,22,285,118,'rgba(3,8,12,.9)',12);
  ctx.fillStyle='#fff';ctx.font='bold 18px Arial';ctx.fillText('CLASIFICACIÓN MTB',791,54);
  const level=data.level?.label||'Sin clasificar';let levelSize=25;
  do{ctx.font='800 '+levelSize+'px Arial';if(ctx.measureText(level).width<=250)break;levelSize--}while(levelSize>15);
  ctx.fillStyle=accent;ctx.fillText(level,791,103);
  if(data.level?.label?.startsWith('Negra')){
    ctx.fillStyle='#f5d64b';ctx.fillRect(791,116,102,5);
    ctx.font='bold 13px Arial';ctx.fillText('TRAZO AMARILLO',902,121);
  }
  // Datos principales, con fondo legible y sin tapar todo el mapa.
  panel(ctx,30,920,405,255,'rgba(3,8,12,.88)',18);
  ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(30,920,405,255,18);ctx.stroke();
  const stats=[['DISTANCIA',data.distance],[data.elevationLabel,data.ascent],['TIEMPO REGISTRADO',data.time]];
  stats.forEach(([label,value],i)=>{
    const y=932+i*78;icon(ctx,i,51,y+8,accent);
    ctx.fillStyle='#cbd3d8';ctx.font='600 16px Arial';ctx.fillText(label,100,y+18);
    let font=31;do{ctx.font='800 '+font+'px Arial';if(ctx.measureText(value).width<=310)break;font--}while(font>18);
    ctx.fillStyle='#fff';ctx.fillText(value,100,y+55);
    if(i<2){ctx.strokeStyle=accent;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(52,y+68);ctx.lineTo(414,y+68);ctx.stroke()}
  });
  // Perfil de elevación ampliado: 220px de alto y escala visible.
  if(data.showProfile){
    panel(ctx,30,1195,1020,236,'rgba(3,8,12,.91)',17);
    ctx.fillStyle='#fff';ctx.font='bold 23px Arial';ctx.fillText('PERFIL DE ELEVACIÓN',54,1230);ctx.font='bold 20px Arial';ctx.textAlign='right';ctx.fillText('ASCENSO ACUMULADO: '+data.ascent,1020,1230);ctx.textAlign='left';
    const pts=source.points,valid=pts.filter(p=>Number.isFinite(p.ele));
    if(valid.length){
      const bounds=valid.reduce((b,p)=>({min:Math.min(b.min,p.ele),max:Math.max(b.max,p.ele)}),{min:Infinity,max:-Infinity});const {min,max}=bounds,range=max-min||1;
      const total=pts.at(-1)?.d||source.distance||1;
      ctx.font='17px Arial';ctx.fillStyle='#d5dee4';
      for(let i=0;i<=3;i++){
        const y=1380-i*42,value=min+range*i/3;
        ctx.fillText(fmt(value,0)+' m',52,y+5);
        ctx.strokeStyle='rgba(255,255,255,.16)';ctx.beginPath();ctx.moveTo(135,y);ctx.lineTo(1020,y);ctx.stroke();
      }
      ctx.strokeStyle=accent;ctx.lineWidth=4;ctx.beginPath();
      for(const run of posterRuns(pts)){
        let previous=false;for(const index of run){
          const p=pts[index];if(!Number.isFinite(p.ele)||!Number.isFinite(p.d)){previous=false;continue}
          const x=135+Math.max(0,Math.min(1,p.d/total))*885,y=1380-(p.ele-min)/range*126;
          if(previous)ctx.lineTo(x,y);else ctx.moveTo(x,y);previous=true;
        }
      }
      ctx.stroke();
      ctx.fillStyle='#d5dee4';ctx.font='17px Arial';
      ctx.fillText('0 km',135,1411);ctx.textAlign='right';ctx.fillText(data.distance,1020,1411);ctx.textAlign='left';
    }else{ctx.fillStyle='#fff';ctx.font='21px Arial';ctx.fillText('Sin datos de elevación',54,1320)}
  }
  if(data.showTips){
    panel(ctx,30,1445,1020,64,'rgba(3,8,12,.95)',12);
    ctx.fillStyle='#fff';ctx.font='bold 19px Arial';
    ctx.fillText('AGUA SUFICIENTE  ·  PROTÉGETE DEL SOL  ·  REVISA TU BICI  ·  RESPETA EL SENDERO',49,1485);
  }
  ctx.fillStyle='#080b0d';ctx.fillRect(0,1520,1080,100);
  ctx.fillStyle=accent;ctx.fillRect(30,1521,1020,3);
  ctx.fillStyle='#fff';ctx.font='italic 800 31px Arial';ctx.textAlign='center';
  ctx.fillText('¡PEDALEA, DISFRUTA, SUPERA TUS LÍMITES!',540,1571);
  ctx.fillStyle='#b5c0c8';ctx.font='16px Arial';ctx.fillText('PERROS EN BICICLETA · RUTA Y COMUNIDAD',540,1599);
  ctx.font='13px Arial';ctx.fillText('© OpenStreetMap contributors · © OpenTopoMap (CC BY-SA) · GeoNames CC BY 4.0',540,1616);
  ctx.textAlign='left';
  return manualWarnings;
}
function localityMode(){return JSON.stringify([$('posterLocalities')?.checked?($('posterExternalLocalities')?.checked?'external':'catalogue'):'off',manualText])}
function posterMessages(){const notes=[resources?.localityMessage,...(resources?.manualWarnings||[]),...(resources?.layoutWarnings||[])].filter(Boolean);return notes.length?' · '+notes.join(' '):''}
function options(){return {name:$('posterName')?.value.trim()||activity?.name,level:$('posterLevel')?.value||'',showProfile:$('posterProfile')?.checked!==false,showTips:$('posterTips')?.checked!==false,showLocalities:$('posterLocalities')?.checked!==false||!!manualText,externalLocalities:$('posterExternalLocalities')?.checked===true,titleFont:$('posterFont')?.value||'blackops'}}
function update(){
  if(resources&&resources.localityMode!==localityMode()){resources=null;canvas=null;$('posterPreview').replaceChildren(empty())}
  revision++;$('downloadPoster').disabled=true;if(!activity)return;
  const data={...options(),...posterData(activity,options())};$('posterMetrics').textContent=`${data.distance} · ${data.ascent} · ${data.time}`;
  $('posterScore').textContent=`Puntos distancia: ${data.distancePts??'—'} · Desnivel: ${data.elevationPts??'—'}. El nivel se elige considerando también terreno, técnica y exposición.`;
  if(resources&&canvas){
    const selected=activity,version=revision,key=data.titleFont;
    $('posterStatus').textContent='Aplicando tipografía…';
    ensureTitleFont(key).then(ok=>{
      if(selected!==activity||version!==revision||!canvas)return;
      if(!ok){$('posterStatus').textContent='No se pudo cargar la tipografía. Revisa tu conexión.';return}
      resources.layoutWarnings=drawPoster(canvas,activity,{...data,titleFontReady:true},resources);
      $('downloadPoster').disabled=false;$('posterStatus').textContent='Cartel listo · 1080 × 1620'+posterMessages();
    });
  }
  else $('posterStatus').textContent='Personaliza los datos y genera tu cartel';
}
function empty(){const div=document.createElement('div');div.className='poster-empty';const b=document.createElement('b');b.textContent='Aún no hay una ruta cargada';const span=document.createElement('span');span.textContent='Sube una actividad desde Resumen para preparar tu cartel.';div.append(b,span);return div}
export function setPosterActivity(next){
  if(next===activity)return;
  controller?.abort();controller=null;$('cancelPoster').hidden=true;revision++;activity=next;resources=null;canvas=null;manualText='';
  $('posterPreview').replaceChildren(empty());$('posterData').replaceChildren();$('makePoster').disabled=!next;$('downloadPoster').disabled=true;
  if(!next){$('posterStatus').textContent='Esperando ruta';return}
  $('posterData').innerHTML='<label class="poster-field">Nombre de la ruta<input id="posterName" maxlength="140" type="text"></label><label class="poster-field">Clasificación MTB<select id="posterLevel"><option value="">Sin clasificar</option></select></label><label class="poster-field">Tipografía del título<select id="posterFont"></select></label><label class="poster-field"><input id="posterLocalities" type="checkbox" checked> Mostrar localidades del catálogo</label><label class="poster-field"><input id="posterExternalLocalities" type="checkbox"> Ampliar búsqueda de localidades en línea</label><label class="poster-field"><input id="posterProfile" type="checkbox" checked> Perfil de elevación</label><label class="poster-field"><input id="posterTips" type="checkbox" checked> Recomendaciones de seguridad</label><p id="posterMetrics" class="poster-route-name"></p><p id="posterScore" class="poster-note"></p><p class="poster-note">Formato vertical 1080 × 1620. Se usa primero el catálogo incluido. Ampliar la búsqueda envía un área aproximada del recorrido a nuestro servidor y, fuera de la cobertura del catálogo, a Overpass. No se envían puntos individuales a Nominatim.</p>';
  for(const [key,font] of Object.entries(TITLE_FONTS)){const opt=document.createElement('option');opt.value=key;opt.textContent=font.label;$('posterFont').appendChild(opt)}
  $('posterData').insertAdjacentHTML('beforeend','<button type="button" class="action-btn secondary" id="posterManualOpen">Agregar localidades al cartel</button><p id="posterManualSummary" class="poster-note"></p><dialog id="posterManualDialog" class="poster-localities-dialog" aria-labelledby="posterManualTitle"><h3 id="posterManualTitle">Agregar localidades al cartel</h3><label class="poster-field" for="posterManualNames">Si no ves las localidades por las que pasas, agrégalas y sepáralas por una coma<textarea id="posterManualNames" rows="4" maxlength="1200" placeholder="Localidad uno, localidad dos"></textarea></label><p class="poster-note">Hasta 10 localidades. Puedes añadir municipio o estado dentro de cada nombre para distinguir localidades homónimas. Al generar el cartel se envían los nombres y el centro aproximado del mapa al servicio de búsqueda de openrouteservice. Se colocan en sus coordenadas, sin moverlas a la ruta.</p><p id="posterManualError" role="alert"></p><div class="poster-actions"><button type="button" class="action-btn" id="posterManualDone">Aplicar localidades</button><button type="button" class="action-btn secondary" id="posterManualCancel">Cancelar</button></div></dialog>');
  $('posterManualOpen').addEventListener('click',()=>{$('posterManualNames').value=manualText;$('posterManualError').textContent='';$('posterManualDialog').showModal()});
  $('posterManualCancel').addEventListener('click',()=>$('posterManualDialog').close());
  $('posterManualDone').addEventListener('click',()=>{try{const names=parseManualLocalities($('posterManualNames').value);manualText=names.join(', ');$('posterManualSummary').textContent=names.length?'Localidades para buscar: '+manualText:'';$('posterManualDialog').close();update()}catch(error){$('posterManualError').textContent=error.message}});
  $('posterFont').value='blackops';
  $('posterName').value=next.name.slice(0,140);for(const [value,level] of Object.entries(POSTER_LEVELS)){const opt=document.createElement('option');opt.value=value;opt.textContent=level.label;$('posterLevel').appendChild(opt)}
  $('posterName').addEventListener('input',update);$('posterLevel').addEventListener('change',update);$('posterFont').addEventListener('change',update);
  for(const id of ['posterLocalities','posterExternalLocalities','posterProfile','posterTips'])$(id).addEventListener('change',update);
  update();$('posterPreview').firstChild.querySelector('b').textContent='Tu cartel aparecerá aquí';$('posterPreview').firstChild.querySelector('span').textContent='Elige el nombre y la clasificación, y pulsa Generar cartel.';
}
export function cancelPoster(){controller?.abort()}
export async function generatePoster(){
  if(!activity||controller)return;
  const selected=activity,task=createPosterTask(),abort=task.controller;controller=abort;$('cancelPoster').hidden=false;const fields=[$('posterName'),$('posterLevel'),$('posterFont'),$('posterLocalities'),$('posterExternalLocalities'),$('posterProfile'),$('posterTips'),$('posterManualOpen')];fields.forEach(e=>e.disabled=true);$('makePoster').disabled=true;$('downloadPoster').disabled=true;
  try{
    $('posterStatus').textContent='Cargando mapa de relieve, localidades y logo…';
    if(resources?.localityRetry)resources=null;
    if(!resources){const snapshot=posterMapSnapshot(selected.points,1080,1460,70),map=document.createElement('canvas');map.width=snapshot.width;map.height=snapshot.height;const ctx=map.getContext('2d');ctx.fillStyle='#e6eade';ctx.fillRect(0,0,map.width,map.height);
      const [logo,tiles,localities,manual]=await task.wait(Promise.all([
        image(new URL('../assets/logo-perros-en-bicicleta.png',import.meta.url).href,abort.signal),
        Promise.all(snapshot.tiles.map(async tile=>{
          const terrain=tile.url.replace('https://tile.openstreetmap.org/','https://a.tile.opentopomap.org/');
          let loaded;try{loaded=await image(terrain,abort.signal)}catch(e){if(abort.signal.aborted)throw e;loaded=await image(tile.url,abort.signal)}
          return {...tile,image:loaded};
        })),
        $('posterLocalities').checked?posterLocalities(selected.points,abort.signal,{external:$('posterExternalLocalities').checked}):Promise.resolve({places:[],message:''}),
        manualPosterLocalities(manualText,selected.points,snapshot,abort.signal)
      ]));
      if(abort.signal.aborted)throw aborted();tiles.forEach(tile=>ctx.drawImage(tile.image,tile.x,tile.y,256,256));resources={logo,map,snapshot,localities:mergeManualLabels(localities.places,manual.places),localitySpares:mergeManualLabels(localities.spares||[],manual.places).filter(p=>!p.manual),localityMessage:localities.message,manualWarnings:manual.warnings,localityRetry:localities.retry===true||manual.warnings.length>0,localityMode:localityMode()};
    }
    const chosenFont=options().titleFont,titleFontReady=await task.wait(ensureTitleFont(chosenFont));if(abort.signal.aborted)throw aborted();if(!titleFontReady)throw Error('No se pudo cargar la tipografía seleccionada. Revisa tu conexión o elige Arial · Clásica.');
    canvas=document.createElement('canvas');canvas.className='poster-canvas';canvas.setAttribute('aria-label','Cartel de la ruta con mapa, clasificación y datos');resources.layoutWarnings=drawPoster(canvas,selected,{...options(),...posterData(selected,options()),titleFontReady},resources);canvas.getContext('2d').getImageData(0,0,1,1);
    if(abort.signal.aborted||activity!==selected)throw aborted();$('posterPreview').replaceChildren(canvas);$('posterStatus').textContent='Cartel listo · 1080 × 1620'+posterMessages();$('downloadPoster').disabled=false;
  }catch(e){if(activity===selected&&controller===abort)$('posterStatus').textContent=e.name==='AbortError'?'Generación cancelada.':e.message;abort.abort()}
  finally{task.dispose();if(controller===abort){controller=null;$('cancelPoster').hidden=true;$('makePoster').disabled=!activity;fields.forEach(e=>e.disabled=false)}}
}
export async function downloadPoster(){
  if(!canvas||!activity||controller)return;
  const selected=activity,version=revision,name=options().name;$('downloadPoster').disabled=true;
  try{const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('No se pudo guardar el cartel.');if(activity!==selected||revision!==version)return;const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(name||'ruta').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'_cartel.png';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);$('posterStatus').textContent='Cartel PNG descargado.'+posterMessages()}
  catch(e){if(activity===selected)$('posterStatus').textContent=e.message}
  finally{if(activity===selected&&canvas&&!controller)$('downloadPoster').disabled=false}
}
