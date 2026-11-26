import test from 'node:test';
import assert from 'node:assert/strict';
import { androidVersionCode, parseOctoVersion, stampAndroidGradle } from '../../scripts/versioning.js';

test('release candidate parser rejects invalid version input', () => {
  assert.deepEqual(parseOctoVersion('5.1.0-rc.1'),
    {major:5, minor:1, patch:0, candidate:1});
  for (const invalid of ['v5.1.0', '5.1', '5.1.0-dev', '5.1.0-rc.0',
    '5.1.0-rc.99', '5.100.0', '5.1.100', '5.1.0;rm -rf /']) {
    assert.throws(() => parseOctoVersion(invalid));
  }
});

test('Android version code increases from candidate to final', () => {
  assert.equal(androidVersionCode('5.1.0-rc.1'), 5010001);
  assert.ok(androidVersionCode('5.1.0-rc.1') < androidVersionCode('5.1.0-rc.2'));
  assert.ok(androidVersionCode('5.1.0-rc.2') < androidVersionCode('5.1.0'));
  assert.ok(androidVersionCode('5.1.0') < androidVersionCode('5.1.1-rc.1'));
});

test('stamps only the generated Android build version fields', () => {
  const old = 'android { defaultConfig {\n  versionCode 1\n  versionName "1.0"\n  minSdkVersion 24\n}}\n';
  const updated = stampAndroidGradle(old, '5.1.0-rc.1');
  assert.match(updated, /versionCode 5010001/);
  assert.match(updated, /versionName "5\.1\.0-rc\.1"/);
  assert.match(updated, /minSdkVersion 24/);
  assert.equal(stampAndroidGradle(updated, '5.1.0-rc.1'), updated);
  assert.throws(() => stampAndroidGradle('versionCode 1', '5.1.0-rc.1'), /Expected one/);
  assert.throws(() => stampAndroidGradle(old + '\nversionCode 2', '5.1.0-rc.1'), /Expected one/);
});

test('rejects leading zero components and coerced non-string versions', () => {
  for (const value of ['05.1.0', '5.01.0', '5.1.00', '5.1.0-rc.01', ['5.1.0'], null]) {
    assert.throws(() => parseOctoVersion(value));
  }
});
