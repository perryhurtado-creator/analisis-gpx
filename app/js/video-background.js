// La elección se captura al iniciar la generación y no cambia durante el trabajo.
export function watchVideoVisibility(doc,allowBackground,cancel){
  const onChange=()=>{if(doc.hidden&&!allowBackground)cancel()};
  doc.addEventListener('visibilitychange',onChange);
  return ()=>doc.removeEventListener('visibilitychange',onChange);
}
