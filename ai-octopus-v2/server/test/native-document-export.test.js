import test from 'node:test';
import assert from 'node:assert/strict';

// The production frontend is a browser-native ESM module. Give the test a
// minimal WebView environment before importing the shared PDF export helper.
globalThis.document = {
  baseURI: 'https://octo.test/app/',
  querySelector: () => null
};

class ReaderStub {
  readAsDataURL(blob) {
    blob.arrayBuffer().then(bytes => {
      this.result = 'data:application/octet-stream;base64,'
        + Buffer.from(bytes).toString('base64');
      this.onload?.();
    }, () => this.onerror?.());
  }
}
globalThis.FileReader = ReaderStub;
const { downloadFile } = await import('../../web/vendor-loader.js');

function androidWith(plugins, registerPlugin) {
  globalThis.window = {
    Capacitor: { getPlatform: () => 'android', Plugins: plugins, registerPlugin }
  };
}

test('Android PDF exports use native Capacitor.Plugins even when registerPlugin is absent', async () => {
  const parts = [];
  const calls = [];
  const native = {
    begin: async () => { calls.push('begin'); },
    append: async ({data}) => {
      calls.push('append');
      parts.push(Buffer.from(data, 'base64'));
    },
    finish: async ({name, type}) => {
      calls.push('finish');
      assert.deepEqual({name, type}, {name: 'octo-pages.pdf', type: 'application/pdf'});
      return {saved: true};
    },
    discard: async () => { throw Error('discard should not be called'); }
  };
  androidWith({ OctoDocument: native });
  const source = Buffer.alloc(300 * 1024, 71); // Larger than one 256 KiB bridge chunk
  assert.equal(await downloadFile(source, 'application/pdf', 'octo-pages.pdf'), 'saved');
  assert.deepEqual(Buffer.concat(parts), source);
  assert.deepEqual(calls, ['begin', 'append', 'append', 'finish']);
});

test('Android native export preserves save-cancelled response', async () => {
  androidWith({ OctoDocument: {
    begin: async () => {},
    append: async () => {},
    finish: async () => ({saved: false}),
    discard: async () => {}
  }});
  assert.equal(await downloadFile('pdf', 'application/pdf', 'test.pdf'), 'cancelled');
});

test('missing or incomplete Android plugin reports a helpful error instead of TypeError', async () => {
  for (const plugins of [undefined, {}, {OctoDocument: {begin: async () => {}}}]) {
    androidWith(plugins);
    await assert.rejects(
      downloadFile('pdf', 'application/pdf', 'test.pdf'),
      /Android file saving is unavailable in this build/
    );
  }
});

test('Android save discards partial data when plugin append fails', async () => {
  let discarded = 0;
  androidWith({ OctoDocument: {
    begin: async () => {},
    append: async () => { throw Error('native write failed'); },
    finish: async () => { throw Error('should not finish'); },
    discard: async () => { discarded++; }
  }});
  await assert.rejects(downloadFile('pdf', 'application/pdf', 'test.pdf'), /native write failed/);
  assert.equal(discarded, 1);
});

test('Capacitor core registration fallback works when Android native map is not exposed', async () => {
  let registeredName = '';
  const native = {
    begin: async () => {},
    append: async () => {},
    finish: async () => ({saved: true}),
    discard: async () => {}
  };
  androidWith(undefined, name => {
    registeredName = name;
    return native;
  });
  assert.equal(await downloadFile('pdf', 'application/pdf', 'fallback.pdf'), 'saved');
  assert.equal(registeredName, 'OctoDocument');
});
