import test from 'node:test';
import assert from 'node:assert/strict';
import { localAnalyze, grammarReview, compareDrafts, improveClarity, countWords } from '../src/analysis.js';

test('pattern score stays bounded and labels missing input',()=>{
  assert.equal(localAnalyze('Too short').available,false);
  const text='The team discussed the project. Each member shared an idea. Several suggestions were useful. The team wrote a plan. They tested the approach. Some details changed. The report described the outcomes. Everyone reviewed the document and suggested small improvements. They agreed to make the final version easier to understand for every reader.';
  const a=localAnalyze(text);assert.equal(a.available,true);assert.ok(a.score>=0&&a.score<=100);
});
test('word counting handles everyday text',()=>assert.equal(countWords('An idea, two ideas!'),4));
test('grammar review surfaces repeated words and spacing',()=>{
  const r=grammarReview('This is is a test  with two spaces ! I agree.');
  assert.ok(r.issues.some(i=>i.type==='Repeated word'));
  assert.ok(r.issues.some(i=>i.type==='Spacing'));
});
test('word-level diff identifies changed text',()=>{
  const r=compareDrafts('red blue green','red bright green');
  assert.equal(r.added,1);assert.equal(r.removed,1);
  assert.equal(r.parts.find(x=>x.kind==='added').word,'bright');
});
test('clarity edits are conservative',()=>assert.equal(improveClarity('We utilize tools in order to work.'),'We use tools to work.'));
