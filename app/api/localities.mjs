import {withApiLimits} from './rate-limit.mjs';
import {regionalLocalities} from '../js/catalogues/localities-regional.mjs';
import {cachedLocalities} from '../js/catalogues/localities-cache.mjs';
import {boundedJSON} from './safety.mjs';
// Respuestas completas: caché pública de 24 h. Truncadas: 1 h. Degradadas o con error: nunca,
// para que un fallo momentáneo de Overpass no se quede servido a todo el mundo durante un día.
const CACHE={full:'public, s-maxage=86400, stale-while-revalidate=3600',short:'public, s-maxage=3600',none:'no-store'};
const json=(body,status=200,cache=status===200?'full':'none')=>Response.json(body,{status,headers:{'Cache-Control':CACHE[cache]}});
const CREDIT='© OpenStreetMap contributors · GeoNames CC BY 4.0';
// Límites por nivel: las aldeas pequeñas no deben desplazar a ciudades, pueblos y comunidades.
const MAJOR_LIMIT=500,MINOR_LIMIT=800;
// Mismo nombre y coordenadas casi idénticas = mismo lugar. Si una fuente trae categoría OSM
// y la otra no (catálogo), se conserva la que la trae, sin importar el orden.
function unique(list){
  const out=[];
  for(const p of list){
    const i=out.findIndex(q=>q.name===p.name&&Math.abs(q.lat-p.lat)<.001&&Math.abs(q.lon-p.lon)<.001);
    if(i<0)out.push(p);else if(p.place&&!out[i].place)out[i]={...p};
  }
  return out;
}
async function handle(request){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Solicitud no permitida.'},403);
  const raw=new URL(request.url).searchParams.get('bbox')?.split(',');
  if(!raw||raw.length!==4||raw.some(v=>!v.trim()||!Number.isFinite(Number(v))))return json({error:'Área inválida.'},400);
  const [s,w,n,e]=raw.map(Number);
  if(s < -85||n > 85||w < -180||e > 180||s>=n||w>=e||n-s>2||e-w>2||(n-s)*(e-w)>1)return json({error:'La ruta abarca un área demasiado grande para consultar localidades.'},400);
  const known=unique([...(cachedLocalities([s,w,n,e])||[]),...(regionalLocalities([s,w,n,e])||[])]);
  // Los catálogos locales no traen categorías: se consulta también OSM (solo se llega aquí si la persona lo pidió).
  const box=`(${s},${w},${n},${e})`;
  const query=`[out:json][timeout:12];(nwr["place"~"^(city|town|village)$"]["name"]${box};)->.major;(nwr["place"="hamlet"]["name"]${box};)->.minor;.major out center ${MAJOR_LIMIT};.minor out center ${MINOR_LIMIT};`;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.private.coffee/api/interpreter']){
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'User-Agent':'PerrosEnBicicleta-GPX/1.0 (+https://github.com/perryhurtado-creator/analisis-gpx)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(16000)});
      if(!response.ok)continue;
      const data=await boundedJSON(response,8*1024*1024);if(!Array.isArray(data.elements)||data.remark)continue;
      const major=data.elements.filter(p=>/^(city|town|village)$/.test(p.tags?.place)).length;
      const minor=data.elements.filter(p=>p.tags?.place==='hamlet').length;
      const truncated=major>=MAJOR_LIMIT||minor>=MINOR_LIMIT;
      const places=data.elements.map(p=>({...p,lat:p.lat??p.center?.lat,lon:p.lon??p.center?.lon})).filter(p=>typeof p.tags?.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=s&&p.lat<=n&&p.lon>=w&&p.lon<=e).slice(0,MAJOR_LIMIT+MINOR_LIMIT).map(p=>{
        const place={name:p.tags.name.slice(0,100),lat:p.lat,lon:p.lon};
        if(p.tags.place)place.place=p.tags.place;
        if(p.tags.population)place.population=p.tags.population;
        return place;
      });
      return json({places:unique([...known,...places]),credit:CREDIT,source:'catalogue+overpass',...(truncated?{truncated:true}:{})},200,truncated?'short':'full');
    }catch(error){console.error('Localities provider:',error.name)}
  }
  if(known.length)return json({places:known,credit:CREDIT,source:'partial-catalogue',partial:true},200,'none');
  return json({error:'El servicio de localidades no está disponible. Puedes generar el video sin nombres.'},502);
}

export const GET=request=>withApiLimits(request,'localities',handle);
