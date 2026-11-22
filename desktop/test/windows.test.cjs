const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { test } = require('node:test');
const { _electron: electron } = require('playwright');

test('packaged Studio runs locally and converts PDF to Word', { timeout: 120000 }, async t => {
  const profile = await mkdtemp(resolve(tmpdir(), 'octo-desktop-'));
  const executablePath = resolve(__dirname, '../dist/win-unpacked/Octo AI Studio.exe');
  let program;
  t.after(async () => {
    if (program) await program.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 4 });
  });
  program = await electron.launch({ executablePath, args: ['--user-data-dir=' + profile], timeout: 40000 });
  const page = await program.firstWindow();
  await program.evaluate(({ dialog }, directory) => {
    const path = process.getBuiltinModule('node:path');
    dialog.showSaveDialog = async (_window, options) => ({
      canceled: false, filePath: path.join(directory, options.defaultPath)
    });
  }, profile);
  await page.locator('#overview-view').waitFor({ state: 'visible' });
  assert.equal(await page.title(), 'Octo AI Studio');
  assert.equal(await page.locator('.studio-tile').count(), 12);
  assert.deepEqual(await page.evaluate(() => [location.origin, isSecureContext, typeof require]), ['octo://studio', true, 'undefined']);

  const logo = await page.locator('.identity img').evaluate(async image => {
    await image.decode();
    return image.naturalWidth;
  });
  assert.ok(logo >= 64);

  await page.getByRole('tab', { name: 'AI Assistant' }).click();
  await page.locator('#assistant-prompt').fill('Create an outline for a work update');
  await page.locator('#assistant-send').click();
  await page.locator('#assistant-messages').getByText(/Starter outline/).waitFor();

  await page.getByRole('tab', { name: 'Document Studio' }).click();
  const text = 'The Windows edition creates printable documents.';
  await page.locator('#doc-text').fill(text);
  await page.locator('#doc-page-numbers').uncheck();
  await page.locator('#doc-create').click();
  await page.getByText('PDF saved.', { exact: true }).waitFor();
  const pdfBytes = await readFile(resolve(profile, 'octo-document.pdf'));
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');

  await page.locator('.feature-switches [data-doc-workflow="word"]').click();
  await page.locator('#doc-input').setInputFiles({ name: 'studio-test.pdf', mimeType: 'application/pdf', buffer: pdfBytes });
  await page.waitForFunction(value => document.getElementById('doc-text').value === value
    && document.getElementById('doc-export-status').textContent.startsWith('Text imported.'), text);
  await page.locator('#doc-create').click();
  await page.getByText('DOCX saved.', { exact: true }).waitFor();
  assert.equal((await readFile(resolve(profile, 'studio-test.docx'))).subarray(0, 2).toString(), 'PK');

  const models = await page.evaluate(async () => {
    const response = await fetch('./vendor/face-models/face_recognition_model-weights_manifest.json');
    const manifest = await response.json();
    if (!response.ok || !Array.isArray(manifest) || !manifest[0]?.paths?.length) return false;
    const weights = await fetch('./vendor/face-models/' + manifest[0].paths[0], { method: 'HEAD' });
    return weights.ok && Number(weights.headers.get('content-length')) > 1000;
  });
  assert.equal(models, true);
});
