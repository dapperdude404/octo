import test from 'node:test';
import assert from 'node:assert/strict';
import {assessAcademicDraft,ACADEMIC_CRITERIA} from '../src/research/quality.js';
test('criteria add up to 100 without fabricating a full grade',()=>{
  assert.equal(ACADEMIC_CRITERIA.reduce((n,c)=>n+c.max,0),100);
  const result=assessAcademicDraft('Abstract\n\nIntroduction\nA study was conducted [1].\n\nReferences\n[1] Source.');
  assert.equal(result.score.totalOutOf100,null);
  assert.equal(result.score.complete,false);
  assert.equal(result.score.assessedMax+result.score.unassessedMax,100);
  assert.ok(result.criteria.find(c=>c.id==='accuracy').evidence==='not_assessed');
});
test('empty draft cannot be reported as verified research',()=>{
  const result=assessAcademicDraft('');
  assert.equal(result.wordCount,0);
  assert.equal(result.criteria.find(c=>c.id==='originality').score,0);
});
test('score bounds hold for repetitive and long drafts',()=>{
  const result=assessAcademicDraft(('It is important to note that this is a sentence. ').repeat(500));
  for(const c of result.criteria)assert.ok(c.score>=0&&c.score<=c.max,c.id);
});
