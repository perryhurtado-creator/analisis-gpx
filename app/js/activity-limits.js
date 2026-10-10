// Límites compartidos por la carga principal, comparación y parsers directos.
export const MAX_FILE_BYTES=10*1024*1024;
export const MAX_TRACK_POINTS=50000;
export function validateActivityFile(file){
  if(!/\.(gpx|tcx)$/i.test(file?.name||''))throw Error('Selecciona un archivo GPX o TCX.');
  if(!Number.isFinite(file.size)||file.size<=0)throw Error('El archivo está vacío o no se puede leer.');
  if(file.size>MAX_FILE_BYTES)throw Error('El archivo supera el límite de 10 MiB. Divide la actividad antes de cargarla.');
}
export function validateActivityXML(text){
  if(new TextEncoder().encode(text).byteLength>MAX_FILE_BYTES)throw Error('El archivo supera el límite de 10 MiB.');
  if(/<!\s*(?:DOCTYPE|ENTITY)\b/i.test(text))throw Error('El archivo contiene declaraciones XML no permitidas.');
  let count=0;
  for(const match of text.matchAll(/<(?:[\w.-]+:)?(?:trkpt|Trackpoint)\b/g)){
    if(++count>MAX_TRACK_POINTS)throw Error('La actividad supera el límite de 50 000 puntos. Divide el archivo antes de cargarlo.');
  }
}
export function validatePointCount(count){
  if(count>MAX_TRACK_POINTS)throw Error('La actividad supera el límite de 50 000 puntos.');
}
