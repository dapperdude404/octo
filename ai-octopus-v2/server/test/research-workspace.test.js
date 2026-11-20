import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {suggestAcademicEdits,applyAcademicDecisions} from '../src/research/revisions.js';
const root=resolve(import.meta.dirname,'../..');
const read=path=>readFile(resolve(root,path),'utf8');
test('review UI has accessible source, revision, controls, status and evidence regions',async()=>{
 const html=await read('web/research/index.html');
 for(const marker of ['id="source"','id="revised"','readonly','id="suggestions"','id="evidence"','role="status"','aria-live="polite"','id="restore"','id="style"'])assert.ok(html.includes(marker),marker);
 const js=await read('web/research/workspace.js');
 assert.match(js,/aria-pressed/);assert.match(js,/replaceChildren/);
 assert.doesNotMatch(js,/\.innerHTML\s*=/);
});
test('accepted, rejected and restored decisions preserve immutable source and research tokens',()=>{
 const source='In order to assess [1], x = 0.42. Due to the fact that data were limited, we reported 10 cases.';
 const {suggestions}=suggestAcademicEdits(source,{style:'ieee'});
 assert.equal(suggestions.length,2);
 const accepted=applyAcademicDecisions(source,suggestions,{[suggestions[0].id]:'accept',[suggestions[1].id]:'reject'});
 assert.match(accepted,/to assess \[1\], x = 0\.42/);
 assert.match(accepted,/Due to the fact that/);
 assert.match(accepted,/10 cases/);
 assert.equal(applyAcademicDecisions(source,suggestions,{}),source);
 assert.throws(()=>applyAcademicDecisions(source+' changed',suggestions,{}));
});
test('research preview is copied into server public with shared pure engines',async()=>{
 const result=spawnSync(process.execPath,['scripts/build-web.js'],{cwd:root,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 for(const name of ['revisions','quality','citations']){
  const original=await read(`server/src/research/${name}.js`);
  const copied=await read(`server/public/research/engine/${name}.js`);
  assert.equal(copied,original);
 }
 assert.ok((await stat(resolve(root,'server/public/research/index.html'))).isFile());
});
