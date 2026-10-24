import {withApiLimits} from './rate-limit.mjs';
import {regionalLocalities} from '../js/catalogues/localities-regional.mjs';
import {cachedLocalities} from '../js/catalogues/localities-cache.mjs';
import {boundedJSON} from './safety.mjs';
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':status===200?'public, s-maxage=86400, stale-while-revalidate=3600':'no-store'}});
async function handle(request){
  if(request.headers.get('sec-fetch-site')==='cross-site')return json({error:'Solicitud no permitida.'},403);
  const raw=new URL(request.url).searchParams.get('bbox')?.split(',');
  if(!raw||raw.length!==4||raw.some(v=>!v.trim()||!Number.isFinite(Number(v))))return json({error:'Área inválida.'},400);
  const [s,w,n,e]=raw.map(Number);
  if(s < -85||n > 85||w < -180||e > 180||s>=n||w>=e||n-s>2||e-w>2||(n-s)*(e-w)>1)return json({error:'La ruta abarca un área demasiado grande para consultar localidades.'},400);
  const cached=cachedLocalities([s,w,n,e])||[];
  const regional=regionalLocalities([s,w,n,e])||[];
  const known=[...cached,...regional].filter((p,i,all)=>all.findIndex(q=>q.name===p.name&&Math.abs(q.lat-p.lat)<.001&&Math.abs(q.lon-p.lon)<.001)===i);
  // Si el catálogo cubre por completo la zona, evitar solicitudes externas.
  const inCache=s>=20.33&&w>=-100.42&&n<=20.57&&e<=-100.18;
  const inRegion=s>=20&&w>=-100.5&&n<=21.7&&e<=-99;
  // Consultar clasificación OSM también en zonas con catálogo local: éste no incluye categorías.
  const query=`[out:json][timeout:12];nwr["place"~"^(city|town|village|hamlet)$"]["name"](${s},${w},${n},${e});out center 1000;`;
  for(const endpoint of ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter']){
    try{
      const response=await fetch(endpoint,{method:'POST',headers:{'User-Agent':'PerrosEnBicicleta-GPX/1.0 (+https://github.com/perryhurtado-creator/analisis-gpx)'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(16000)});
      if(!response.ok)continue;
      const data=await boundedJSON(response,8*1024*1024);if(!Array.isArray(data.elements)||data.remark)continue;
      const places=data.elements.map(p=>({...p,lat:p.lat??p.center?.lat,lon:p.lon??p.center?.lon})).filter(p=>typeof p.tags?.name==='string'&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=s&&p.lat<=n&&p.lon>=w&&p.lon<=e).slice(0,1000).map(p=>({name:p.tags.name.slice(0,100),lat:p.lat,lon:p.lon,place:p.tags.place,population:p.tags.population||null}));
      return json({places:[...known,...places].filter((p,i,all)=>all.findIndex(q=>q.name===p.name&&Math.abs(q.lat-p.lat)<.001&&Math.abs(q.lon-p.lon)<.001)===i),credit:'© OpenStreetMap contributors · GeoNames CC BY 4.0',source:'catalogue+overpass'});
    }catch(error){console.error('Localities provider:',error.name)}
  }
  if(known.length)return json({places:known,credit:'© OpenStreetMap contributors · GeoNames CC BY 4.0',source:'partial-catalogue',partial:true});
  return json({error:'El servicio de localidades no está disponible. Puedes generar el video sin nombres.'},502);
}

export const GET=request=>withApiLimits(request,'localities',handle);
