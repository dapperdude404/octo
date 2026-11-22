const canonicalOnPages = new URL('./', import.meta.url).pathname.endsWith('/ai-octopus-v2/web/');
const assetBase = new URL(
  document.querySelector('meta[name="octo-vendor-root"]')?.content || (canonicalOnPages ? '../../app/vendor/' : './vendor/'),
  document.baseURI
);
const scripts = new Map();

export function vendorUrl(path) {
  return new URL(path, assetBase).href;
}

export function loadVendor(path, globalName) {
  if (!scripts.has(path)) {
    const pending = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = vendorUrl(path);
      script.onload = () => {
        if (globalThis[globalName]) resolve(globalThis[globalName]);
        else reject(new Error('Could not start ' + globalName + '.'));
      };
      script.onerror = () => {
        script.remove();
        reject(new Error('Could not load ' + globalName + '. Check the workspace connection and try again.'));
      };
      document.head.append(script);
    });
    scripts.set(path, pending);
    pending.catch(() => scripts.delete(path));
  }
  return scripts.get(path);
}

async function saveOnAndroid(blob, type, name) {
  const saver = window.Capacitor.registerPlugin('OctoDocument');
  await saver.begin();
  try {
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < blob.size; offset += chunkSize) {
      const chunk = blob.slice(offset, offset + chunkSize);
      const encoded = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(Error('Could not prepare this file for saving.'));
        reader.readAsDataURL(chunk);
      });
      await saver.append({data: encoded});
    }
    return await saver.finish({name, type: type.split(';')[0]});
  } catch (error) {
    await saver.discard().catch(() => {});
    throw error;
  }
}

export async function downloadFile(data, type, name) {
  const blob = data instanceof Blob ? data : new Blob([data], {type});
  if (window.octoDesktop || window.Capacitor?.getPlatform() === 'android') {
    if (blob.size > 128 * 1024 * 1024) throw Error('File exports are limited to 128 MB.');
    const result = window.octoDesktop
      ? await window.octoDesktop.saveDocument(name, await blob.arrayBuffer())
      : await saveOnAndroid(blob, type, name);
    return result.saved ? 'saved' : 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
  return 'download';
}
