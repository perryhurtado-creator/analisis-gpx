import {createHmac,randomBytes} from 'node:crypto';
import {isIP} from 'node:net';
import {boundedJSON} from './safety.mjs';

// El modo local limita una instancia. Redis comparte contadores entre instancias.
const limits={route:{minute:30,day:200,concurrent:2},places:{minute:60,day:1000,concurrent:5},localities:{minute:60,day:2000,concurrent:5}};
const local=new Map(),active=new Map(),localSalt=randomBytes(32);let warned=false;
const script=`
for i=1,2 do
 local count=tonumber(redis.call('GET',KEYS[i]) or '0')
 if count>=tonumber(ARGV[i]) then return {0,tonumber(ARGV[i+2])} end
end
for i=1,2 do
 local count=redis.call('INCR',KEYS[i])
 if count==1 then redis.call('EXPIRE',KEYS[i],tonumber(ARGV[i+2])) end
end
return {1,0}`;
const error=(message,status,retry=60)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store','Retry-After':String(retry)}});
function redisConfig(env){
  // Nunca combinar la URL de un par con el token de otro.
  if(env.UPSTASH_REDIS_REST_URL||env.UPSTASH_REDIS_REST_TOKEN)return {url:env.UPSTASH_REDIS_REST_URL,token:env.UPSTASH_REDIS_REST_TOKEN};
  return {url:env.KV_REST_API_URL,token:env.KV_REST_API_TOKEN};
}
export function rateLimitMode(env=process.env){
  const {url,token}=redisConfig(env);
  if(url&&token)return 'distributed';
  return url||token||env.API_RATE_LIMIT_MODE==='distributed'?'unconfigured':'local';
}
function localAllowance(keys,caps,ttls,now){
  for(const [key,v] of local)if(v.expires<=now)local.delete(key);
  if(local.size>10000)return {allowed:false,retry:60};
  for(let i=0;i<keys.length;i++){const v=local.get(keys[i]);if(v&&v.count>=caps[i])return {allowed:false,retry:Math.max(1,Math.ceil((v.expires-now)/1000))}}
  keys.forEach((key,i)=>{const v=local.get(key);local.set(key,{count:(v?.count||0)+1,expires:v?.expires||now+ttls[i]*1000})});
  return {allowed:true,retry:0};
}
export async function withApiLimits(request,scope,handler,options={}){
  const env=options.env||process.env,now=options.now?.()??Date.now(),mode=rateLimitMode(env),limit=limits[scope];
  if(request.headers.get('sec-fetch-site')==='cross-site')return error('Solicitud no permitida.',403);
  if(mode==='unconfigured')return error('La protección de consultas aún no está configurada. Intenta más tarde.',503);
  if(mode==='local'&&env.VERCEL==='1'&&!warned){warned=true;console.warn('API: protección local activa; falta activar los contadores distribuidos.');}
  const redis=redisConfig(env);
  const forwarded=env.VERCEL==='1'?request.headers.get('x-forwarded-for'):null;
  const candidate=forwarded?.split(',')[0]?.trim();
  const identity=candidate&&isIP(candidate)?candidate:'unknown';
  const hash=createHmac('sha256',redis.token||localSalt).update(identity).digest('hex');
  const prefix=env.VERCEL_ENV||'local',minute=Math.floor(now/60000),day=Math.floor(now/86400000);
  const keys=[`gpx:${prefix}:${scope}:${hash}:${minute}`,`gpx:${prefix}:${scope}:all:${day}`];
  const caps=[limit.minute,limit.day],ttls=[60-Math.floor(now/1000)%60,86400-Math.floor(now/1000)%86400];
  let allowance;
  if(mode==='distributed'){
    try{
      const url=new URL(redis.url);
      if(url.protocol!=='https:'||!url.hostname.endsWith('.upstash.io'))throw Error('Invalid counter endpoint');
      const response=await (options.fetcher||fetch)(url.href,{method:'POST',headers:{Authorization:'Bearer '+redis.token,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'2',...keys,...caps.map(String),...ttls.map(String)]),signal:AbortSignal.timeout(2000)});
      if(!response.ok)throw Error('Counter unavailable');
      const data=await boundedJSON(response,4096);
      if(!Array.isArray(data.result)||data.result.length!==2||![0,1].includes(data.result[0])||!Number.isFinite(data.result[1]))throw Error('Invalid counter response');
      allowance={allowed:data.result[0]===1,retry:Math.max(1,Math.ceil(data.result[1]))};
    }catch{console.error('API: contador distribuido no disponible.');return error('No se pudo verificar el límite de consultas. Intenta más tarde.',503);}
  }else allowance=localAllowance(keys,caps,ttls,now);
  if(!allowance.allowed)return error('Se alcanzó el límite de consultas. Intenta más tarde.',429,allowance.retry);
  if((active.get(scope)||0)>=limit.concurrent)return error('Hay varias consultas en curso. Intenta en unos segundos.',429,5);
  active.set(scope,(active.get(scope)||0)+1);
  try{return await handler(request)}finally{active.set(scope,active.get(scope)-1)}
}
