import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
let failed=0;
for(const file of readdirSync('app/tests').filter(f=>f.endsWith('-tests.mjs')).sort()){
  const result=spawnSync(process.execPath,['app/tests/'+file],{stdio:'inherit',timeout:30000});
  if(result.status!==0){failed++;console.error('FAIL:',file,result.error?.message||'')}
}
console.log(failed?`${failed} suites fallaron.`:'Todas las suites pasaron.');
process.exitCode=failed?1:0;
