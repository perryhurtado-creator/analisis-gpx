import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('app'),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.woff':'font/woff'};
const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return}const p=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;res.writeHead(200,{'Content-Type':mime[extname(p)]||'application/octet-stream'});res.end(await readFile(p))}catch{res.writeHead(404).end()}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true});const context=await browser.newContext({acceptDownloads:true});
  const tile=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAACv0lEQVR4nO3TMQEAIAzAMMC/0F1oQAZHEwV9uufOgqrzOwB+MgBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0gxAmgFIMwBpBiDNAKQZgDQDkGYA0h5iUwS+SkWMCgAAAABJRU5ErkJggg==','base64');
  await context.route('https://**/*',async route=>{
    const url=route.request().url();
    if(url.includes('unpkg.com/leaflet@1.9.4/dist/')){const file=url.split('/').at(-1);if(['leaflet.js','leaflet.css'].includes(file))return route.fulfill({status:200,contentType:file.endsWith('.js')?'text/javascript':'text/css',body:await readFile(resolve(root,'js/vendor/leaflet',file))})}
    if(url.includes('tile.'))return route.fulfill({status:200,contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*'},body:tile});
    return route.abort();
  });
  const analyticsEvents=[],localityRequests=[],fontRequests=[],externalFontRequests=[];
  context.on('request',request=>{const u=new URL(request.url());if(u.pathname.endsWith('.woff'))fontRequests.push(u);if(/fonts\.(googleapis|gstatic)\.com$/.test(u.hostname))externalFontRequests.push(u.href)});
  await context.route('**/_vercel/insights/script.js',route=>route.fulfill({contentType:'text/javascript',body:`(()=>{let hook=e=>e;const q=window.vaq||[];window.va=(type,e)=>{if(type==='beforeSend'){hook=e;return}if(type==='pageview'){const event=hook({type:'pageview',url:location.href});if(event)fetch('/_vercel/insights/view',{method:'POST',body:JSON.stringify({o:event.url,r:document.referrer})})}};q.forEach(a=>window.va(...a))})()`}));
  await context.route('**/_vercel/insights/view',async route=>{analyticsEvents.push({body:route.request().postDataJSON(),referrer:route.request().headers()['referer']});await route.fulfill({status:200,body:'{}'})});
  await context.route('**/api/localities?**',async route=>{localityRequests.push(route.request().url());const partial=localityRequests.length===1;await route.fulfill({contentType:'application/json',body:JSON.stringify({places:[{name:'Localidad de prueba',lat:20,lon:-100,...(!partial?{place:'village',population:'2500'}:{})}],partial,source:partial?'partial-catalogue':'catalogue+overpass'})})});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['tests/continuity-tests.html','tests/map-lifecycle-tests.html']){
    await page.goto(base+'/'+path);await page.waitForFunction(()=>/\d+\/\d+/.test(document.querySelector('#summary')?.textContent||''));
    const text=await page.locator('#summary').innerText();const [n,total]=text.match(/(\d+)\/(\d+)/).slice(1).map(Number);assert.equal(n,total,await page.locator('#results').innerText());console.log('PASS navegador:',path,text);
  }
  await page.goto(base+'/?correo=privado#resumen',{referer:'https://externo.test/persona?token=secreto'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.readyState==='complete');
  await page.waitForTimeout(100);assert.equal(analyticsEvents.length,1);assert.equal(analyticsEvents[0].body.o,base+'/resumen');assert.equal(analyticsEvents[0].body.r,'');assert(!analyticsEvents[0].referrer);
  const points=Array.from({length:120},(_,i)=>`<trkpt lat="20" lon="${-100+i*.0001}"><ele>${i===40?'':100+Math.sin(i/15)*15}</ele><time>${new Date(1700000000000+i*1000).toISOString()}</time><extensions><hr>${i===60?'':160}</hr></extensions></trkpt>`).join('');
  await page.locator('#fileInput').setInputFiles({name:'datos-sinteticos.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from('<gpx><trk><name>Datos sintéticos de prueba</name><trkseg>'+points+'</trkseg></trk></gpx>')});
  await page.locator('#fileStatus').filter({hasText:'correctamente'}).waitFor();assert.equal(await page.locator('#map .leaflet-map-pane').count(),1);
  const totals=await page.evaluate(async()=>{
    const {parseGPX}=await import('/js/gpx-parser.js');
    const {segments}=await import('/js/metrics.js');
    const input=document.querySelector('#fileInput'),a=parseGPX(await input.files[0].text(),input.files[0].name);
    const rows=Array.from(document.querySelectorAll('#segments tr'));
    const displayedDistance=rows.reduce((n,r)=>n+Number(r.children[1].textContent.replace(' km','').replaceAll(',',''))*1000,0);
    const displayedSeconds=rows.reduce((n,r)=>{const t=r.children[2].textContent;return n+Number(t.match(/(\d+) h/)?.[1]||0)*3600+Number(t.match(/(\d+) min/)?.[1]||0)*60+Number(t.match(/(\d+) s/)?.[1]||0)},0);
    return {count:rows.length,expectedMetres:Math.round(a.distance),displayedDistance,expectedSeconds:Math.round(segments(a).reduce((n,r)=>n+(r.time||0),0)/1000),displayedSeconds};
  });
  assert.equal(totals.count,5);assert(Math.abs(totals.displayedDistance-totals.expectedMetres)<1e-6);assert.equal(totals.displayedSeconds,totals.expectedSeconds);
  for(const id of ['elevationChart','heartChart'])assert.equal((await page.locator('#'+id+' path[fill="none"]').getAttribute('d')).match(/M/g).length,2);
  console.log('PASS navegador: totales visibles de cinco tramos conservados y gráficas con huecos reales.');
  await page.locator('#heartMax').fill('202');await page.locator('#heartMax').press('Tab');assert.equal(await page.locator('#heartStats tbody tr').count(),5);
  await page.locator('#explorerPlay').click();await page.waitForFunction(()=>Number(document.querySelector('#explorerSeek').value)>1);await page.locator('#explorerPlay').click();
  await page.locator('a[href="#cartel"]').click();assert.equal(await page.locator('#posterExternalLocalities').isChecked(),false);
  let releaseFont,fontStarted;const fontWait=new Promise(resolve=>releaseFont=resolve),fontRequest=new Promise(resolve=>fontStarted=resolve);
  const holdFont=async route=>{fontStarted();await fontWait;await route.continue().catch(()=>{})};
  await context.route('**/assets/fonts/blackopsone.woff',holdFont);
  await page.locator('#makePoster').click();await fontRequest;
  await page.locator('#cancelPoster').click();await page.locator('#makePoster:enabled').waitFor();assert((await page.locator('#posterStatus').innerText()).includes('cancelada'));assert(await page.locator('#cancelPoster').isHidden());
  releaseFont();await context.unroute('**/assets/fonts/blackopsone.woff',holdFont);
  await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();
  for(const key of ['anton','bebas','bangers','marker','blackops']){
    await page.locator('#posterFont').selectOption(key);await page.locator('#downloadPoster:enabled').waitFor();
    assert(await page.evaluate(async key=>{const {TITLE_FONTS}=await import('/js/poster-fonts.js');return document.fonts.check('400 52px "'+TITLE_FONTS[key].family+'"','LA MAGNÍFICA QUERÉTARO ÑÜ2026')},key));
  }
  assert.equal(externalFontRequests.length,0);assert.equal(new Set(fontRequests.map(u=>u.pathname)).size,5);assert(fontRequests.every(u=>u.origin===base));
  assert.equal(localityRequests.length,0,'El cartel usa el catálogo sin enviar el área');
  await page.locator('#posterExternalLocalities').check();await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();assert.equal(localityRequests.length,1);
  assert.match(await page.locator('#posterStatus').innerText(),/No se pudieron obtener categorías/);
  const partialDownload=page.waitForEvent('download');await page.locator('#downloadPoster').click();await partialDownload;
  assert.match(await page.locator('#posterStatus').innerText(),/No se pudieron obtener categorías/,'el aviso permanece después de descargar');
  await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();assert.equal(localityRequests.length,2);
  assert.match(await page.locator('#posterStatus').innerText(),/consulta por área/);
  await page.locator('#posterExternalLocalities').uncheck();await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();assert.equal(localityRequests.length,2);
  console.log('PASS navegador: aviso de selección limitada, descarga conserva aviso y regeneración recupera categorías.');
  assert(analyticsEvents.every(e=>!e.body.r&&!e.referrer&&!e.body.o.includes('?')&&!e.body.o.includes('#')));
  const pngPromise=page.waitForEvent('download');await page.locator('#downloadPoster').click();const png=await pngPromise;const bytes=await readFile(await png.path());assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1620);
  await page.locator('a[href="#video"]').click();await page.locator('#videoElevationChart svg').waitFor();const downloadPromise=page.waitForEvent('download',{timeout:120000});await page.locator('#makeVideo').click();await page.getByRole('button',{name:'Entendido, generar video'}).click();const movie=await downloadPromise;assert((await stat(await movie.path())).size>1024);assert(/\.(mp4|webm)$/.test(movie.suggestedFilename()));
  assert.deepEqual(errors,[]);console.log('PASS navegador: carga GPX, Leaflet, zonas personales, explorador, cartel PNG y video real descargado.');
  assert((await page.locator('#elevationStats').innerText()).includes('Sostenida (60 m)'));
  assert((await page.locator('#elevationStats').innerText()).includes('Fuente: altitudes del archivo'));
  await page.locator('a[href="#resumen"]').click();
  const tcx='<TrainingCenterDatabase><Activities><Activity><Lap><Track>'+[36,36,120,36,36].map((speed,i)=>`<Trackpoint><Time>${new Date(1700000000000+i*1000).toISOString()}</Time><Position><LatitudeDegrees>20</LatitudeDegrees><LongitudeDegrees>${-100+i*.0001}</LongitudeDegrees></Position><DistanceMeters>${i*10}</DistanceMeters><AltitudeMeters>${100+i}</AltitudeMeters><Extensions><Speed>${speed/3.6}</Speed></Extensions></Trackpoint>`).join('')+'</Track></Lap></Activity></Activities></TrainingCenterDatabase>';
  await page.locator('#fileInput').setInputFiles({name:'pico-sensor.tcx',mimeType:'application/xml',buffer:Buffer.from(tcx)});
  await page.waitForFunction(()=>document.querySelector('#routeMeta').textContent.startsWith('TCX'));
  assert.equal(await page.locator('#speedStats tbody td').first().innerText(),'36 km/h');
  assert.equal(await page.locator('#speedStats tbody td').nth(1).innerText(),'36 km/h');
  assert((await page.locator('#speedStats').innerText()).includes('Muestras de sensor sin validar: 1'));
  assert.equal(await page.locator('#elevationStats tbody tr').nth(1).locator('td').nth(1).innerText(),'—','Menos de 60 m no tiene pendiente sostenida');
  assert((await page.locator('#activityLimits').innerText()).includes('30 MiB'));
  const rte='<gpx><rte><name>Ruta de planificador</name><rtept lat="20" lon="-100"/><rtept lat="20" lon="-99.999"/></rte></gpx>';
  await page.locator('#fileInput').setInputFiles({name:'planificada.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from(rte)});
  await page.waitForFunction(()=>document.querySelector('#routeName').textContent==='Ruta de planificador');assert.equal(await page.locator('#map .leaflet-map-pane').count(),1);
  console.log('PASS navegador: cartel cancelable durante carga de fuente, reintento, GPX rtept y límite de carga real.');
  assert.deepEqual(errors,[]);console.log('PASS navegador: TCX descarta pico de 120 km/h, explica la fuente y no anuncia pendiente sostenida con menos de 60 m.');
  await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r))}
