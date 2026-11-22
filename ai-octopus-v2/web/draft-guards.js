/**
 * Fail closed when an importer or callback returns a malformed payload.
 * Never stringify undefined/null into the user’s manuscript editor.
 * These checks do not verify PDF/DOCX contents or document provenance.
 */
export function requireDraftText(value) {
  if (typeof value !== 'string') {
    throw new TypeError('This operation did not return text. Your existing draft was preserved.');
  }
  return value;
}

export function validateImportedDocument(result) {
  if (result === null || typeof result !== 'object' || Array.isArray(result)) {
    throw new TypeError('The document importer returned an invalid result. Your draft was preserved.');
  }
  const text = requireDraftText(result.text);
  if (!text.trim()) throw new Error('No readable text was found in this document. Your draft was preserved.');
  if (text.length > 150000) throw new Error('The imported text is too long. Your draft was preserved.');
  return { text, truncated: result.truncated === true };
}
