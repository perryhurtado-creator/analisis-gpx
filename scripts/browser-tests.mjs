import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('app'),mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png'};
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
  const analyticsEvents=[],localityRequests=[];
  await context.route('**/_vercel/insights/script.js',route=>route.fulfill({contentType:'text/javascript',body:`(()=>{let hook=e=>e;const q=window.vaq||[];window.va=(type,e)=>{if(type==='beforeSend'){hook=e;return}if(type==='pageview'){const event=hook({type:'pageview',url:location.href});if(event)fetch('/_vercel/insights/view',{method:'POST',body:JSON.stringify({o:event.url,r:document.referrer})})}};q.forEach(a=>window.va(...a))})()`}));
  await context.route('**/_vercel/insights/view',async route=>{analyticsEvents.push({body:route.request().postDataJSON(),referrer:route.request().headers()['referer']});await route.fulfill({status:200,body:'{}'})});
  await context.route('**/api/localities?**',async route=>{localityRequests.push(route.request().url());await route.fulfill({contentType:'application/json',body:JSON.stringify({places:[{name:'Localidad de prueba',lat:20,lon:-100}]})})});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const path of ['tests/continuity-tests.html','tests/map-lifecycle-tests.html']){
    await page.goto(base+'/'+path);await page.waitForFunction(()=>/\d+\/\d+/.test(document.querySelector('#summary')?.textContent||''));
    const text=await page.locator('#summary').innerText();const [n,total]=text.match(/(\d+)\/(\d+)/).slice(1).map(Number);assert.equal(n,total,await page.locator('#results').innerText());console.log('PASS navegador:',path,text);
  }
  await page.goto(base+'/?correo=privado#resumen',{referer:'https://externo.test/persona?token=secreto'});
  await page.waitForFunction(()=>document.querySelector('iframe')?.contentDocument?.readyState==='complete');
  await page.waitForTimeout(100);assert.equal(analyticsEvents.length,1);assert.equal(analyticsEvents[0].body.o,base+'/resumen');assert.equal(analyticsEvents[0].body.r,'');assert(!analyticsEvents[0].referrer);
  const points=Array.from({length:120},(_,i)=>`<trkpt lat="20" lon="${-100+i*.0001}"><ele>${100+Math.sin(i/15)*15}</ele><time>${new Date(1700000000000+i*1000).toISOString()}</time><extensions><hr>160</hr></extensions></trkpt>`).join('');
  await page.locator('#fileInput').setInputFiles({name:'datos-sinteticos.gpx',mimeType:'application/gpx+xml',buffer:Buffer.from('<gpx><trk><name>Datos sintéticos de prueba</name><trkseg>'+points+'</trkseg></trk></gpx>')});
  await page.locator('#fileStatus').filter({hasText:'correctamente'}).waitFor();assert.equal(await page.locator('#map .leaflet-map-pane').count(),1);
  await page.locator('#heartMax').fill('202');await page.locator('#heartMax').press('Tab');assert.equal(await page.locator('#heartStats tbody tr').count(),5);
  await page.locator('#explorerPlay').click();await page.waitForFunction(()=>Number(document.querySelector('#explorerSeek').value)>1);await page.locator('#explorerPlay').click();
  await page.locator('a[href="#cartel"]').click();await page.locator('#posterFont').selectOption('classic');assert.equal(await page.locator('#posterExternalLocalities').isChecked(),false);await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();
  assert.equal(localityRequests.length,0,'El cartel usa el catálogo sin enviar el área');
  await page.locator('#posterExternalLocalities').check();await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();assert.equal(localityRequests.length,1);
  await page.locator('#posterExternalLocalities').uncheck();await page.locator('#makePoster').click();await page.locator('#downloadPoster:enabled').waitFor();assert.equal(localityRequests.length,1);
  assert(analyticsEvents.every(e=>!e.body.r&&!e.referrer&&!e.body.o.includes('?')&&!e.body.o.includes('#')));
  const pngPromise=page.waitForEvent('download');await page.locator('#downloadPoster').click();const png=await pngPromise;const bytes=await readFile(await png.path());assert.equal(bytes.readUInt32BE(16),1080);assert.equal(bytes.readUInt32BE(20),1620);
  await page.locator('a[href="#video"]').click();await page.locator('#videoElevationChart svg').waitFor();const downloadPromise=page.waitForEvent('download',{timeout:120000});await page.locator('#makeVideo').click();await page.getByRole('button',{name:'Entendido, generar video'}).click();const movie=await downloadPromise;assert((await stat(await movie.path())).size>1024);assert(/\.(mp4|webm)$/.test(movie.suggestedFilename()));
  assert.deepEqual(errors,[]);console.log('PASS navegador: carga GPX, Leaflet, zonas personales, explorador, cartel PNG y video real descargado.');
  await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r))}
