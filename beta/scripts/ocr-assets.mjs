/* Met en place les fichiers de l'OCR dans public/ocr, pour qu'ils soient servis
   par l'application elle-même et non par un CDN : moteur (worker), cœur
   WebAssembly, et le modèle français « fast » (1,1 Mo).

   Lancé par `npm run ocr` — et par `npm install` via postinstall. */

import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'

const ici = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pub = join(ici, '..', 'public', 'ocr')
mkdirSync(join(pub, 'core'), { recursive: true })
mkdirSync(join(pub, 'lang'), { recursive: true })

const tess = dirname(require.resolve('tesseract.js/package.json'))
const core = dirname(require.resolve('tesseract.js-core/package.json'))
copyFileSync(join(tess, 'dist', 'worker.min.js'), join(pub, 'worker.min.js'))
for (const f of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  copyFileSync(join(core, f), join(pub, 'core', f))
}

const modele = join(pub, 'lang', 'fra.traineddata')
if (!existsSync(modele)) {
  const url = 'https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/fra.traineddata.gz'
  const r = await fetch(url)
  if (!r.ok) throw new Error(`téléchargement du modèle : ${r.status}`)
  writeFileSync(modele, gunzipSync(Buffer.from(await r.arrayBuffer())))
}
console.log('OCR prêt dans public/ocr')
