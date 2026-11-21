import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDocx,safeDocumentName} from '../src/documents.js';
test('DOCX export creates a Word ZIP file',async()=>{
  const bytes=await makeDocx('Hello Octopus!\nA second paragraph.');
  assert.ok(bytes.length>700);
  assert.equal(bytes.subarray(0,2).toString(),'PK');
});
test('filename sanitization prevents header injection',()=>{
  assert.equal(safeDocumentName('report\r\nmalicious.docx'),'report--malicious.docx');
  assert.ok(!safeDocumentName('../unsafe').includes('/'));
  assert.equal(safeDocumentName('...'), 'ai-octopus-document');
});
