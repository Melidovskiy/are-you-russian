import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { buildGuides } from './build-guides.mjs';
import { buildWhoami } from './build-whoami.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
await mkdir(path.join(destination, 'src'));
for (const name of ['index.html', 'src/styles.css', 'assets', 'LICENSE']) {
  await cp(path.join(root, name), path.join(destination, name), { recursive: true });
}
await cp(path.join(root, 'src/theme-init.js'), path.join(destination, 'theme-init.js'));
await build({
  entryPoints: [path.join(root, 'src/app.js')],
  outfile: path.join(destination, 'app.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
await build({
  entryPoints: [path.join(root, 'src/guides.js')],
  outfile: path.join(destination, 'guides.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
await build({
  entryPoints: [path.join(root, 'src/whoami.js')],
  outfile: path.join(destination, 'whoami.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
await buildGuides(root, destination);
await buildWhoami(destination);
await cp(path.join(root, 'downloads'), path.join(destination, 'downloads'), { recursive: true });
console.log('Готово. Статический сайт находится в dist/.');
