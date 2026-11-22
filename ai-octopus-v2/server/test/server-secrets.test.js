import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveServerSecret, withOAuthSecrets } from '../src/server-secrets.js';

function fixture(fn) {
  const directory = mkdtempSync(join(tmpdir(), 'octo-oauth-secrets-'));
  try { return fn(directory); }
  finally { rmSync(directory, {recursive: true, force: true}); }
}

test('loads GitHub and Google secrets from Render-style files when env values are missing', () => fixture(directory => {
  writeFileSync(join(directory, 'GITHUB_CLIENT_SECRET'), 'from-github-file\n');
  writeFileSync(join(directory, 'GOOGLE_CLIENT_SECRET'), 'from-google-file\n');
  const actual = withOAuthSecrets({GITHUB_CLIENT_ID:'test-id'}, {directory});
  assert.equal(actual.GITHUB_CLIENT_SECRET, 'from-github-file');
  assert.equal(actual.GOOGLE_CLIENT_SECRET, 'from-google-file');
  assert.equal(actual.GITHUB_CLIENT_ID, 'test-id');
}));

test('explicit environment variables override secret files', () => fixture(directory => {
  writeFileSync(join(directory, 'GITHUB_CLIENT_SECRET'), 'stale-file-secret');
  assert.equal(resolveServerSecret('GITHUB_CLIENT_SECRET', {
    environment: { GITHUB_CLIENT_SECRET: 'current-env-secret' }, directory
  }), 'current-env-secret');
}));

test('missing secret files disable provider without fabricating configuration', () => fixture(directory => {
  assert.equal(resolveServerSecret('GITHUB_CLIENT_SECRET', {environment:{},directory}), '');
}));

test('rejects symlinks, directories, oversized files and unknown secret names', () => fixture(directory => {
  const target = join(directory,'test.txt');
  writeFileSync(target,'secret');
  symlinkSync(target,join(directory,'GITHUB_CLIENT_SECRET'));
  assert.throws(()=>resolveServerSecret('GITHUB_CLIENT_SECRET',{environment:{},directory}),/regular file/);
  mkdirSync(join(directory,'GOOGLE_CLIENT_SECRET'));
  assert.throws(()=>resolveServerSecret('GOOGLE_CLIENT_SECRET',{environment:{},directory}),/regular file/);
  assert.throws(()=>resolveServerSecret('DATABASE_URL',{environment:{},directory}),/Unsupported/);
  rmSync(join(directory,'GITHUB_CLIENT_SECRET'));
  writeFileSync(join(directory,'GITHUB_CLIENT_SECRET'),'x'.repeat(8193));
  assert.throws(()=>resolveServerSecret('GITHUB_CLIENT_SECRET',{environment:{},directory}),/8 KB/);
}));
