import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const resources = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url));
const icon = new URL('../web/assets/octo-icon.png', import.meta.url);
const foreground = new URL('../web/assets/octo-foreground.png', import.meta.url);

for (const folder of await readdir(resources)) {
  if (!/^mipmap-(mdpi|hdpi|xhdpi|xxhdpi|xxxhdpi)$/.test(folder)) continue;
  for (const [name, source] of [
    ['ic_launcher.png', icon],
    ['ic_launcher_round.png', icon],
    ['ic_launcher_foreground.png', foreground]
  ]) {
    await copyFile(source, join(resources, folder, name));
  }
}

await writeFile(join(resources, 'values', 'octo_launcher.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources><color name="octo_launcher_background">#202440</color></resources>\n');
const adaptive = join(resources, 'mipmap-anydpi-v26');
await mkdir(adaptive, { recursive: true });
const xml = '<?xml version="1.0" encoding="utf-8"?>\n'
  + '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
  + '    <background android:drawable="@color/octo_launcher_background" />\n'
  + '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
  + '</adaptive-icon>\n';
for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
  await writeFile(join(adaptive, name), xml);
}
console.log('Octo Studio launcher icons are ready.');
