// Aviso explícito y Wake Lock durante la exportación; no garantiza ejecución en segundo plano.
export async function prepareVideoWakeLock(){
  const accepted=await new Promise(resolve=>{
    const overlay=document.createElement('div');
    overlay.setAttribute('role','presentation');
    overlay.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;padding:20px';
    const panel=document.createElement('section');
    panel.setAttribute('role','alertdialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','exportWakeTitle');panel.setAttribute('aria-describedby','exportWakeText');
    panel.style.cssText='background:#fff;color:#17231c;border-radius:16px;padding:24px;width:min(100%,440px);box-shadow:0 12px 40px #0005';
    panel.innerHTML='<h2 id="exportWakeTitle" style="margin:0 0 12px;font-size:1.3rem">Antes de guardar el video</h2><p id="exportWakeText">Mantén esta pestaña visible y el teléfono desbloqueado hasta terminar. Intentaremos mantener la pantalla encendida automáticamente, pero Android puede suspender la exportación si bloqueas el equipo o cambias de aplicación. La descarga puede tardar varios minutos.</p>';
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Entendido, generar video';
    for(const b of [cancel,confirm])b.style.cssText='padding:12px 14px;border-radius:9px;border:1px solid #b8c7bd;cursor:pointer;font-weight:600';
    confirm.style.background='#087b4a';confirm.style.color='white';
    actions.append(cancel,confirm);panel.append(actions);overlay.append(panel);document.body.append(overlay);confirm.focus();
    const finish=value=>{document.removeEventListener('keydown',onKey);overlay.remove();resolve(value)};
    const onKey=e=>{if(e.key==='Escape')finish(false);if(e.key==='Tab'){e.preventDefault();(document.activeElement===confirm?cancel:confirm).focus()}};
    document.addEventListener('keydown',onKey);cancel.addEventListener('click',()=>finish(false));confirm.addEventListener('click',()=>finish(true));
  });
  if(!accepted)return {accepted:false,release:async()=>{}};
  let lock=null;
  try{
    if(!navigator.wakeLock?.request)throw Error('Wake Lock no disponible');
    lock=await navigator.wakeLock.request('screen');
  }catch(e){
    console.warn('[Video] No se pudo mantener la pantalla encendida:',e);
    const state=document.getElementById('videoState');
    if(state)state.textContent='Aviso: tu navegador no permitió mantener la pantalla encendida. Evita bloquear el teléfono durante la exportación.';
  }
  let closed=false;
  const onVisibility=async()=>{
    if(closed||document.visibilityState!=='visible'||lock&&!lock.released)return;
    try{lock=await navigator.wakeLock?.request?.('screen')||null}catch(e){console.warn('[Video] No se pudo renovar Wake Lock:',e)}
  };
  document.addEventListener('visibilitychange',onVisibility);
  return {accepted:true,release:async()=>{closed=true;document.removeEventListener('visibilitychange',onVisibility);try{await lock?.release()}catch(e){console.warn('[Video] Error liberando Wake Lock:',e)}}};
}
