import test from 'node:test';
import assert from 'node:assert/strict';
import { androidVersionCode, parseOctoVersion, stampAndroidGradle, androidDebugPackageId, stampAndroidDebugIdentity } from '../../scripts/versioning.js';

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

test('CI Android debug identity is isolated from production and every other run', () => {
  assert.equal(androidDebugPackageId('com.octoai.app', '46045921194'),
    'com.octoai.app.dev46045921194');
  assert.notEqual(androidDebugPackageId('com.octoai.app', '100'),
    androidDebugPackageId('com.octoai.app', '101'));
  for (const id of ['', '0', '01', 'something', '1.2', '1;evil']) {
    assert.throws(() => androidDebugPackageId('com.octoai.app', id));
  }
  assert.throws(() => androidDebugPackageId('not valid', '123'));
});

test('debug app ID suffix does not change stable Android release identity', () => {
  const generated = `android {
    namespace "com.octoai.app"
    defaultConfig {
      applicationId "com.octoai.app"
      versionCode 1
      versionName "1.0"
    }
    buildTypes {
      release {
        minifyEnabled false
      }
    }
  }`;
  const stamped = stampAndroidDebugIdentity(
    stampAndroidGradle(generated, '5.1.0-rc.1'), '46045921194');
  assert.match(stamped, /debug \{ applicationIdSuffix "\.dev46045921194" \}/);
  assert.match(stamped, /applicationId "com\.octoai\.app"/);
  assert.match(stamped, /versionName "5\.1\.0-rc\.1"/);
  assert.match(stamped, /versionCode 5010001/);
  assert.match(stamped, /release \{/);
  assert.throws(() => stampAndroidDebugIdentity(stamped, '46045921194'), /existing applicationIdSuffix/);
  assert.throws(() => stampAndroidDebugIdentity('android {}', '123'), /one Android buildTypes/);
});
