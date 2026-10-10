// Mantiene el plazo activo hasta que también termina la lectura de la respuesta.
export function requestDeadline(controller,ms){
  const timer=setTimeout(()=>controller.abort(new DOMException('La consulta tardó demasiado. Intenta de nuevo.','TimeoutError')),ms);
  return ()=>clearTimeout(timer);
}
