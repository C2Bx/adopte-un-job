// Transforme dist/index.html en dist/index.php qui pose les en-tetes de securite.
//
// Pourquoi : sur l'hebergement mutualise, nginx sert les fichiers statiques
// lui-meme et ignore le .htaccess d'Apache. Les en-tetes ecrits dans
// public/.htaccess ne sortent donc jamais pour index.html. Un index.php passe
// par PHP, et PHP pose les en-tetes. Le reste (JS, CSS, workers, images)
// reste statique : ces fichiers n'ont pas besoin d'en-tetes de page.
//
// La CSP autorise ce que la beta fait vraiment : ses propres scripts et
// styles (React pose des styles en attribut, d'ou 'unsafe-inline' sur
// style-src seulement), des workers pdf.js et Tesseract charges en blob, du
// WebAssembly, des images en data:/blob: (apercu du CV), et l'API sur la meme
// origine. Rien n'est charge d'un CDN.
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const html = resolve(dist, 'index.html')
if (!existsSync(html)) {
  console.error('dist/index.html absent : lancer vite build d abord')
  process.exit(1)
}

const csp = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ')

const entete = `<?php
// Genere par scripts/index-php.mjs a la construction : ne pas modifier ici.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
header("Content-Security-Policy: ${csp}");
header('Cache-Control: no-cache');
header('Content-Type: text/html; charset=utf-8');
?>`

writeFileSync(resolve(dist, 'index.php'), entete + readFileSync(html, 'utf8'))
unlinkSync(html)
console.log('dist/index.php ecrit (en-tetes de securite), dist/index.html retire')
