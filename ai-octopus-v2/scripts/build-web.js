import {cp, mkdir, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = resolve(root, 'web');
const target = resolve(root, 'server/public');
const repository = resolve(root, '..');
const webFiles = [
  'index.html', 'style.css', 'src.js', 'core.js', 'assistant.js', 'documents.js',
  'vision.js', 'vendor-loader.js', 'draft-guards.js', 'manifest.webmanifest', 'classic.html',
  'assets/octopus.svg', 'assets/octo-logo.png', 'assets/octo-icon.png', 'assets/octo-foreground.png',
  'assets/assistant-ribbon.webp', 'assets/studio-hero.webp',
  'assets/inter-latin.woff2', 'assets/inter-OFL.txt'
];
const sync = process.argv.includes('--sync-mirrors');
const check = process.argv.includes('--check-mirrors');

if (sync || check) {
  for (const name of ['app', 'docs', 'online']) {
    const mirror = resolve(repository, name);
    for (const file of webFiles) {
      const output = resolve(mirror, file);
      let bytes = await readFile(resolve(source, file));
      if (file === 'index.html' && name !== 'app') {
        bytes = Buffer.from(bytes.toString().replace(
          '<meta charset="utf-8" />',
          '<meta charset="utf-8" /><meta name="octo-vendor-root" content="../app/vendor/" />'
        ));
      }
      if (sync) {
        if (file.startsWith('assets/')) await mkdir(resolve(mirror, 'assets'), {recursive: true});
        await writeFile(output, bytes);
      } else if (!bytes.equals(await readFile(output))) {
        throw Error('Out-of-date web mirror: ' + name + '/' + file + '. Run npm run web:sync.');
      }
    }
  }
  console.log(sync ? 'Synced app, docs and online from web/.' : 'All web mirrors match web/.');
} else {
  const repositoryVendor = resolve(repository, 'app/vendor');
  const hasRepositoryVendor = await stat(repositoryVendor).then(result => result.isDirectory(), () => false);
  const bundledVendor = hasRepositoryVendor ? repositoryVendor : resolve(source, 'vendor');
  await rm(target, {recursive: true, force: true});
  await mkdir(target, {recursive: true});
  await cp(source, target, {recursive: true});
  if (hasRepositoryVendor) await cp(bundledVendor, resolve(target, 'vendor'), {recursive: true});
  await stat(resolve(target, 'vendor/pdfjs/pdf.mjs'));
  console.log('Web assets copied to ' + target);
}
