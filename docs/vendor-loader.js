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

export function downloadFile(data, type, name) {
  const blob = data instanceof Blob ? data : new Blob([data], {type});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}
