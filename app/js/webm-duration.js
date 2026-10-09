// Completar Duration en WebM de MediaRecorder (segmento sin índice de búsqueda).
// Duration usa ticks de TimestampScale: https://www.matroska.org/technical/elements.html
function element(bytes,offset){
  function vint(at,id=false){
    const first=bytes[at];if(!first)throw Error('Cabecera WebM inválida.');
    let length=1,mask=128;while(!(first&mask)){length++;mask>>=1}
    if(length>8||at+length>bytes.length)throw Error('Cabecera WebM incompleta.');
    let value=BigInt(id?first:first&(mask-1));
    for(let i=1;i<length;i++)value=(value<<8n)|BigInt(bytes[at+i]);
    return {length,value,unknown:!id&&value===(1n<<BigInt(7*length))-1n};
  }
  const id=vint(offset,true),sizeOffset=offset+id.length,size=vint(sizeOffset);
  const data=sizeOffset+size.length,end=size.unknown?bytes.length:data+Number(size.value);
  if(end>bytes.length)throw Error('WebM incompleto.');
  return {id:Number(id.value),offset,sizeOffset,size,data,end};
}
function writeSize(bytes,offset,length,value){
  let n=BigInt(value);if(n>=(1n<<BigInt(7*length))-1n)throw Error('Tamaño WebM no representable.');
  for(let i=length-1;i>=0;i--){bytes[offset+i]=Number(n&255n);n>>=8n}
  bytes[offset]|=1<<(8-length);
}
export async function completeWebmDuration(blob,milliseconds){
  const bytes=new Uint8Array(await blob.arrayBuffer());let segment;
  for(let at=0;at<bytes.length;){const e=element(bytes,at);if(e.id===0x18538067){segment=e;break}at=e.end}
  if(!segment)throw Error('No se encontró el segmento WebM.');
  let info,hasIndex=false;
  for(let at=segment.data;at<segment.end;){const e=element(bytes,at);if(e.id===0x1549a966)info=e;if(e.id===0x114d9b74||e.id===0x1c53bb6b)hasIndex=true;at=e.end}
  if(!info||info.size.unknown)throw Error('No se encontró la información WebM.');
  let scale=1000000,duration;
  for(let at=info.data;at<info.end;){const e=element(bytes,at);if(e.id===0x2ad7b1){scale=0;for(let i=e.data;i<e.end;i++)scale=scale*256+bytes[i]}if(e.id===0x4489)duration=e;at=e.end}
  const ticks=milliseconds*1000000/scale;
  if(duration){const view=new DataView(bytes.buffer);if(duration.end-duration.data===8)view.setFloat64(duration.data,ticks);else if(duration.end-duration.data===4)view.setFloat32(duration.data,ticks);else throw Error('Duración WebM inválida.');return new Blob([bytes],{type:blob.type})}
  // No mover un índice existente: los archivos ya finalizados usan el codificador.
  if(hasIndex)throw Error('El WebM tiene un índice pero no declara su duración.');
  const extra=new Uint8Array(11);extra.set([0x44,0x89,0x88]);new DataView(extra.buffer).setFloat64(3,ticks);
  const result=new Uint8Array(bytes.length+extra.length);result.set(bytes.subarray(0,info.end));result.set(extra,info.end);result.set(bytes.subarray(info.end),info.end+extra.length);
  writeSize(result,info.sizeOffset,info.size.length,Number(info.size.value)+extra.length);
  if(!segment.size.unknown)writeSize(result,segment.sizeOffset,segment.size.length,Number(segment.size.value)+extra.length);
  return new Blob([result],{type:blob.type});
}
