import test from 'node:test';
import assert from 'node:assert/strict';
import { requireDraftText, validateImportedDocument } from '../../web/draft-guards.js';

test('rejects undefined, null and object values instead of writing literal undefined into the editor', () => {
  for (const value of [undefined, null, {}, 42]) assert.throws(() => requireDraftText(value), /did not return text/);
  assert.equal(requireDraftText(''), ''); // Clearing editor still works.
  assert.equal(requireDraftText('Keep [1] and 0.42.'), 'Keep [1] and 0.42.');
});

test('rejects malformed document imports and preserves source text on failure', () => {
  for (const payload of [undefined, null, 'hello', {}, {text: undefined}, {text: ''}, {text: '   '}]) {
    assert.throws(() => validateImportedDocument(payload), /(invalid result|did not return text|No readable text)/);
  }
});

test('accepts a bounded document result, retaining citation and numeric text', () => {
  const input = 'Results [12]: accuracy = 0.42 and n = 10.';
  assert.deepEqual(validateImportedDocument({text: input,truncated:true}), {text:input,truncated:true});
  assert.deepEqual(validateImportedDocument({text: input}), {text:input,truncated:false});
  assert.throws(() => validateImportedDocument({text:'a'.repeat(150001)}), /too long/);
});

test('TXT importer returns actual text and rejects an undefined extraction', async () => {
  const previousDocument = globalThis.document;
  globalThis.document = { baseURI: 'https://example.test/app/', querySelector: () => null };
  try {
    const { readLocalDocument } = await import('../../web/documents.js');
    const validFile = { name: 'research.txt', size: 35, text: async () => 'Results [12], accuracy = 0.42.' };
    assert.deepEqual(await readLocalDocument(validFile), {
      text: 'Results [12], accuracy = 0.42.', truncated: false
    });
    const invalidFile = { name: 'bad.txt', size: 10, text: async () => undefined };
    await assert.rejects(() => readLocalDocument(invalidFile), /No text was found/);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
