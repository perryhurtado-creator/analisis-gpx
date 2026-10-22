export const POSTER_TIMEOUT_MS=45000;
export function waitForPoster(promise,signal){
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(callback,value)=>{if(finished)return;finished=true;signal.removeEventListener('abort',cancel);callback(value)};
    const cancel=()=>finish(reject,signal.reason||new DOMException('Cartel cancelado.','AbortError'));
    Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));
    signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
  });
}
export function createPosterTask(){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('El cartel tardó demasiado. Revisa la conexión o prueba sin la búsqueda en línea y con tipografía Clásica.','TimeoutError')),POSTER_TIMEOUT_MS);
  return {controller,wait:promise=>waitForPoster(promise,controller.signal),dispose:()=>clearTimeout(timer)};
}
