import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const source = resolve('node_modules/onnxruntime-web/dist');
const destination = resolve('public/ort');
const entries = await readdir(source, { withFileTypes: true });
const files = entries.filter((entry) => entry.isFile() && /\.(?:wasm|mjs)$/u.test(entry.name));
if (!files.some((entry) => entry.name.endsWith('.wasm'))) {
  throw new Error('ONNX Runtime WebAssembly assets were not found; refusing to build a remotely dependent model runtime.');
}
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const entry of files) await cp(resolve(source, entry.name), resolve(destination, entry.name));
process.stdout.write(`Copied ${files.length} ONNX Runtime WASM assets into public/ort for same-origin offline use.\n`);
