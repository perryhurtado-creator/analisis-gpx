// Lee por chunks para imponer el límite incluso sin Content-Length.
export async function boundedJSON(response,maxBytes){
  const declared=Number(response.headers.get('content-length'));
  if(declared>maxBytes){await response.body?.cancel();throw Object.assign(Error('Body too large'),{status:413})}
  const reader=response.body?.getReader();if(!reader)throw Error('Empty JSON body');
  const decoder=new TextDecoder();let size=0,text='';
  try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();throw Object.assign(Error('Body too large'),{status:413})}
      text+=decoder.decode(value,{stream:true});
    }
    text+=decoder.decode();return JSON.parse(text);
  }finally{reader.releaseLock()}
}
