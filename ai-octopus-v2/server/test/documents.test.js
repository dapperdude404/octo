import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extractPdfText, makeDocx, safeDocumentName } from '../src/documents.js';
import { readDocumentExtraction } from '../../web/core.js';
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

test('PDF extraction reads a valid uploaded Buffer without an XRef error', async () => {
  const pdf = await readFile(new URL('./fixtures/selectable.pdf', import.meta.url));
  assert.match(await extractPdfText(pdf), /Octo stability test PDF/);
});

test('document extraction preserves valid text and the truncation flag', async () => {
  const text = '  Extracted text\n\n';
  assert.deepEqual(await readDocumentExtraction(Response.json({ text, truncated: true })), { text, truncated: true });
  assert.deepEqual(await readDocumentExtraction(Response.json({ text })), { text, truncated: false });
});

test('document extraction rejects missing, non-string, malformed and non-JSON success responses', async () => {
  const responses = [
    Response.json({}),
    Response.json({ text: null }),
    Response.json({ text: { content: 'a string was expected' } }),
    new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    new Response('{"text":"redirected page"}', { headers: { 'Content-Type': 'text/html' } })
  ];
  for (const response of responses) {
    await assert.rejects(readDocumentExtraction(response), /did not return document text/);
  }
});

test('document extraction reports blank text and server errors', async () => {
  await assert.rejects(readDocumentExtraction(Response.json({ text: ' \n' })), /scanned PDFs/);
  await assert.rejects(
    readDocumentExtraction(Response.json({ error: 'File contents do not match a PDF.' }, { status: 415 })),
    /File contents do not match a PDF/
  );
  await assert.rejects(readDocumentExtraction(new Response('Unavailable', { status: 503 })), /503/);
});
