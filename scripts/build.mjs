import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, 'dist');
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
await mkdir(path.join(destination, 'src'));
for (const name of ['index.html', 'src/styles.css', 'assets', 'LICENSE']) {
  await cp(path.join(root, name), path.join(destination, name), { recursive: true });
}
await build({
  entryPoints: [path.join(root, 'src/app.js')],
  outfile: path.join(destination, 'app.js'),
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
console.log('Готово. Статический сайт находится в dist/.');
