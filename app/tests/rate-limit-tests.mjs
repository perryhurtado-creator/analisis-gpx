import assert from 'node:assert/strict';
import {withApiLimits,rateLimitMode} from '../api/rate-limit.mjs';
const request=(ip='203.0.113.42')=>new Request('https://app.test/api/route',{headers:{'x-forwarded-for':ip}});
const ok=async()=>Response.json({ok:true}),now=()=>1800000000000;
const local={env:{},now};
for(let i=0;i<30;i++)assert.equal((await withApiLimits(request(),'route',ok,local)).status,200);
const blocked=await withApiLimits(request(),'route',ok,local);assert.equal(blocked.status,429);assert(Number(blocked.headers.get('Retry-After'))>0);assert.equal(blocked.headers.get('Cache-Control'),'no-store');
assert.equal((await withApiLimits(request(),'route',ok,{env:{},now:()=>now()+60000})).status,200);
assert.equal(rateLimitMode({API_RATE_LIMIT_MODE:'distributed'}),'unconfigured');assert.equal((await withApiLimits(request(),'route',ok,{env:{API_RATE_LIMIT_MODE:'distributed'}})).status,503);
const env={VERCEL:'1',VERCEL_ENV:'preview',UPSTASH_REDIS_REST_URL:'https://audit.upstash.io',UPSTASH_REDIS_REST_TOKEN:'test-only-token'};
const counts=new Map();let calls=0;
const fetcher=async(url,options)=>{
  calls++;const body=JSON.parse(options.body);assert.equal(body[0],'EVAL');assert.equal(body[2],'2');assert.equal(options.headers.Authorization,'Bearer test-only-token');assert(!options.body.includes('203.0.113.42'));
  const keys=body.slice(3,5),caps=body.slice(5,7).map(Number),ttls=body.slice(7,9).map(Number);
  for(let i=0;i<2;i++)if((counts.get(keys[i])||0)>=caps[i])return Response.json({result:[0,ttls[i]]});
  keys.forEach(k=>counts.set(k,(counts.get(k)||0)+1));return Response.json({result:[1,0]});
};
const other=await import('../api/rate-limit.mjs?another-instance');
for(let i=0;i<30;i++)assert.equal((await (i%2?other.withApiLimits:withApiLimits)(request(),'route',ok,{env,now,fetcher})).status,200);
assert.equal((await other.withApiLimits(request(),'route',ok,{env,now,fetcher})).status,429);assert.equal(calls,31);
assert.equal((await withApiLimits(request('203.0.113.43'),'route',ok,{env,now,fetcher})).status,200);
// Un fallo del contador configurado no degrada silenciosamente a límites locales.
let ran=false;const fail=async()=>{ran=true;return ok()};
assert.equal((await withApiLimits(request(),'route',fail,{env,fetcher:async()=>{throw Error('offline')}})).status,503);assert.equal(ran,false);
assert.equal((await withApiLimits(request(),'route',ok,{env,fetcher:async()=>Response.json({result:'bad'})})).status,503);
// Concurrencia local y liberación tras una excepción del proveedor.
const gates=[];const pending=()=>new Promise(resolve=>gates.push(resolve));
const opts={env:{},now:()=>now()+120000};
const one=withApiLimits(request(),'route',pending,opts),two=withApiLimits(request(),'route',pending,opts);
assert.equal((await withApiLimits(request(),'route',ok,opts)).status,429);gates.forEach(r=>r(Response.json({ok:true})));await Promise.all([one,two]);
await assert.rejects(withApiLimits(request(),'route',async()=>{throw Error('provider')},opts));assert.equal((await withApiLimits(request(),'route',ok,opts)).status,200);
// Presupuesto diario compartido entre direcciones IP, también entre instancias.
counts.clear();
for(let i=0;i<200;i++)assert.equal((await withApiLimits(request(`203.0.113.${i%250+1}`),'route',ok,{env,now:()=>now()+Math.floor(i/20)*60000,fetcher})).status,200);
assert.equal((await other.withApiLimits(request('203.0.113.251'),'route',ok,{env,now:()=>now()+600000,fetcher})).status,429);
console.log('PASS límites: minuto, presupuesto diario, concurrencia/liberación, Redis compartido entre instancias, HMAC, 429/Retry-After y fallo cerrado del contador.');
