import test from 'node:test';
import assert from 'node:assert/strict';
import { localAnalyze, improveClarity } from '../src/analysis.js';

test('local analysis enforces the 40 word minimum from the Octo paper', () => {
  const result = localAnalyze('A short sentence.');
  assert.equal(result.available, false);
});

test('clarity editor replaces common wordy phrases without claiming detector evasion', () => {
  assert.equal(improveClarity('We utilize tools in order to work.'), 'We use tools to work.');
});
