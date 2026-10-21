import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
let failed=0;
function walk(path){for(const item of readdirSync(path,{withFileTypes:true})){if(['.git','node_modules','vendor'].includes(item.name))continue;const name=path+'/'+item.name;if(item.isDirectory())walk(name);else if(/\.(mjs|js)$/.test(name)){const r=spawnSync(process.execPath,['--check',name],{encoding:'utf8'});if(r.status){console.error(r.stderr);failed++}}}}
walk('app');walk('api');walk('scripts');process.exitCode=failed?1:0;
