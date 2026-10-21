(() => {
  'use strict';
  const pages=new Set(['resumen','video','cartel','trazar','privacidad']);
  if(location.pathname==='/analytics-frame.html'){
    let current=null,last=null;
    window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};
    // Solo páginas conocidas. Ignorar URL original, propiedades y eventos personalizados.
    window.va('beforeSend',event=>event.type==='pageview'&&current?{type:'pageview',url:location.origin+'/'+current}:null);
    window.addEventListener('message',event=>{
      if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='gpx-page'||!pages.has(event.data.page))return;
      current=event.data.page;if(current===last)return;last=current;
      window.va('pageview',{path:'/'+current});
    });
    return;
  }
  const frame=document.createElement('iframe');
  frame.hidden=true;frame.title='Estadísticas de visitas';frame.setAttribute('aria-hidden','true');
  // Evita que el SDK reciba como referente la URL de entrada, incluso con datos privados.
  frame.referrerPolicy='no-referrer';frame.src='/analytics-frame.html';
  let ready=false,last=null;
  function send(){
    const raw=location.pathname.endsWith('/privacidad.html')?'privacidad':location.hash.slice(1);
    const page=pages.has(raw)?raw:'resumen';
    if(!ready||page===last)return;last=page;
    frame.contentWindow.postMessage({type:'gpx-page',page},location.origin);
  }
  frame.addEventListener('load',()=>{ready=true;last=null;send()});
  window.addEventListener('hashchange',send);window.addEventListener('popstate',send);
  document.body.appendChild(frame);
})();
