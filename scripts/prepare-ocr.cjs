// Copy only the OCR runtime dependency closure and pinned npm language assets.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const out = path.resolve('desktop/ocr-runtime');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'node_modules'), { recursive: true });
const copied = new Set();
function copy(name, from = require) {
  const manifest = from.resolve(`${name}/package.json`);
  if (copied.has(name)) return;
  copied.add(name);
  const root = path.dirname(manifest);
  fs.cpSync(root, path.join(out, 'node_modules', name), { recursive: true });
  for (const dependency of Object.keys(JSON.parse(fs.readFileSync(manifest)).dependencies || {})) copy(dependency, createRequire(manifest));
}
copy('tesseract.js');
fs.mkdirSync(path.join(out, 'models'), { recursive: true });
for (const language of ['chi_sim', 'eng']) {
  const root = path.dirname(require.resolve(`@tesseract.js-data/${language}/package.json`));
  fs.copyFileSync(path.join(root, '4.0.0_best_int', `${language}.traineddata.gz`), path.join(out, 'models', `${language}.traineddata.gz`));
  for (const file of fs.readdirSync(root).filter(name => /license/i.test(name))) fs.copyFileSync(path.join(root, file), path.join(out, 'models', `${language}-${file}`));
}

fs.writeFileSync(path.join(out, 'offline-worker.cjs'), `
const deny = () => { throw new Error('OCR network access disabled'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const transport = require(name); transport.request = deny; transport.get = deny;
}
require('./node_modules/tesseract.js/src/worker-script/node/index.js');
`);
fs.copyFileSync(require.resolve('tesseract.js/LICENSE.md'), path.join(out, 'models', 'APACHE-2.0.txt'));
fs.writeFileSync(path.join(out, 'models', 'NOTICE.txt'), 'Tesseract chi_sim and eng traineddata: https://github.com/naptha/tessdata (Apache-2.0 upstream training data). Distributed via @tesseract.js-data/chi_sim and @tesseract.js-data/eng (MIT packaging). Versions and integrity hashes are pinned in package-lock.json.\n');
