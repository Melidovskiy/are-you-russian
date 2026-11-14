import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zipSync } from 'fflate';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'extension/.output/chrome-mv3');
const files = {};
async function collect(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) await collect(path.join(directory, entry.name), name + '/');
    else files[name] = new Uint8Array(await readFile(path.join(directory, entry.name)));
  }
}
await collect(source);
const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']));
if (manifest.manifest_version !== 3 || manifest.host_permissions?.length || manifest.permissions.includes('privacy')) throw new Error('Unexpected extension permissions');
files['LICENSE'] = new Uint8Array(await readFile(path.join(root, 'LICENSE')));
await mkdir(path.join(root, 'downloads'), { recursive: true });
await writeFile(path.join(root, 'downloads/are-you-russian-extension.zip'), zipSync(files));
console.log('downloads/are-you-russian-extension.zip');
