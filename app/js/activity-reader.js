import {validateActivityFile} from './activity-limits.js';
import {parseGPX} from './gpx-parser.js';
import {parseTCX} from './tcx-parser.js';
// Una nueva elección o limpiar la actividad invalida la lectura anterior.
export function createActivityReader(onResult,Reader=FileReader){
  let active=null,revision=0;
  function cancel(){revision++;if(active){active.onload=active.onerror=active.onabort=null;if(active.readyState===1)active.abort();active=null}}
  function load(file){
    cancel();const version=revision;
    try{validateActivityFile(file)}catch(error){onResult(null,error);return}
    const reader=new Reader();active=reader;
    const finish=(parsed,error)=>{if(version!==revision)return;active=null;reader.onload=reader.onerror=reader.onabort=null;onResult(parsed,error)};
    reader.onerror=()=>finish(null,Error('No se pudo leer este archivo. Intenta seleccionarlo de nuevo.'));
    reader.onabort=()=>finish(null,Error('Lectura cancelada.'));
    reader.onload=()=>{
      let parsed;
      try{parsed=(/\.tcx$/i.test(file.name)?parseTCX:parseGPX)(String(reader.result),file.name)}catch(error){finish(null,error);return}
      finish(parsed,null);
    };
    try{reader.readAsText(file)}catch(error){finish(null,Error('No se pudo abrir el archivo.'))}
  }
  return {load,cancel};
}
