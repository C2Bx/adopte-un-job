/* Reconnaissance de caractères, dans l'appareil.

   Un scan ou une photo ne contient pas de texte, seulement des pixels. Tesseract
   (WebAssembly) en tire des MOTS AVEC LEUR BOÎTE : c'est exactement ce que
   pdf.js fournit pour un PDF, et la suite de la chaîne — colonnes, bandeau
   d'identité, rubriques — ne voit pas la différence.

   Tout est hébergé chez nous (moteur, cœur WebAssembly, modèle français) : par
   défaut la bibliothèque irait les chercher sur un CDN, et la promesse « rien ne
   sort » vaut aussi pour la trace de qui utilise l'application. Le modèle est la
   variante « fast » : 1,1 Mo, suffisant pour un document imprimé. */

import { createWorker, OEM, PSM } from 'tesseract.js'
import type { Fragment } from './extraction'

export interface PageOCR {
  frags: Fragment[]
  largeur: number
  hauteur: number
  /** Confiance moyenne de Tesseract sur les mots retenus, 0–100. */
  confiance: number
}

export type Avancement = (etape: string, fraction: number) => void

/* Au-delà, une photo 12 Mpx coûte une minute pour rien : les lettres d'un CV
   font quelques pixels de haut, 2 000 px de large suffisent largement. */
const LARGEUR_MAX = 2000
const OCR = `${import.meta.env.BASE_URL}ocr/`

let worker: Awaited<ReturnType<typeof createWorker>> | null = null
let avanceCourant: Avancement | null = null

export async function moteur(avance?: Avancement) {
  avanceCourant = avance ?? null
  if (worker) return worker
  worker = await createWorker('fra', OEM.LSTM_ONLY, {
    workerPath: `${OCR}worker.min.js`,
    corePath: `${OCR}core`,
    langPath: `${OCR}lang`,
    gzip: false,
    logger: (m) => {
      if (!avanceCourant) return
      if (m.status === 'recognizing text') avanceCourant('lecture', m.progress)
      else avanceCourant('préparation', m.progress)
    },
  })
  return worker
}

/** Une image de départ (fichier ou page rendue) devient un canvas propre :
    redimensionné, en niveaux de gris, contraste relevé. C'est la moitié de la
    qualité sur une photo — le reste est de la physique (ombre, reflet). */
export async function prepare(source: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  let img: ImageBitmap | HTMLCanvasElement
  if (source instanceof Blob) {
    // 'from-image' respecte l'orientation EXIF : une photo prise en portrait
    // arrive sinon couchée, et aucune ligne ne se regroupe.
    img = await createImageBitmap(source, { imageOrientation: 'from-image' })
  } else {
    img = source
  }
  const k = Math.min(1, LARGEUR_MAX / img.width)
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.filter = 'grayscale(1) contrast(1.25)'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  if ('close' in img) img.close()
  return c
}

/** Les zones sombres de la page : bandeaux de titre, photo, aplats. On
    découpe en tuiles, on garde celles dont la moyenne est sombre, et on
    regroupe les voisines en rectangles. */
interface Zone { x0: number; y0: number; x1: number; y1: number }

export function zonesSombres(canvas: HTMLCanvasElement): Zone[] {
  const T = 24, SEUIL = 120
  const w = canvas.width, h = canvas.height
  const d = canvas.getContext('2d')!.getImageData(0, 0, w, h).data
  const nx = Math.ceil(w / T), ny = Math.ceil(h / T)
  const sombre = new Uint8Array(nx * ny)
  for (let ty = 0; ty < ny; ty++) {
    for (let tx = 0; tx < nx; tx++) {
      let somme = 0, n = 0
      for (let y = ty * T; y < Math.min(h, ty * T + T); y += 2) {
        for (let x = tx * T; x < Math.min(w, tx * T + T); x += 2) { somme += d[(y * w + x) * 4]!; n++ }
      }
      if (somme / n < SEUIL) sombre[ty * nx + tx] = 1
    }
  }
  // Composantes connexes, quatre voisins, par parcours en largeur.
  const vu = new Uint8Array(nx * ny)
  const zones: Zone[] = []
  for (let k = 0; k < nx * ny; k++) {
    if (!sombre[k] || vu[k]) continue
    const file = [k]; vu[k] = 1
    let x0 = nx, y0 = ny, x1 = -1, y1 = -1, n = 0
    while (file.length) {
      const c = file.pop()!
      const cx = c % nx, cy = (c - cx) / nx
      n++
      if (cx < x0) x0 = cx; if (cx > x1) x1 = cx; if (cy < y0) y0 = cy; if (cy > y1) y1 = cy
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const vx = cx + dx, vy = cy + dy
        if (vx < 0 || vy < 0 || vx >= nx || vy >= ny) continue
        const v = vy * nx + vx
        if (sombre[v] && !vu[v]) { vu[v] = 1; file.push(v) }
      }
    }
    /* Deux tuiles, c'est une puce ; la moitié de la page, c'est un fond sombre
       que la passe principale gère mieux qu'un découpage. */
    if (n < 2 || n > nx * ny * 0.4) continue
    const z: Zone = {
      x0: Math.max(0, x0 * T - T / 2), y0: Math.max(0, y0 * T - T / 2),
      x1: Math.min(w, (x1 + 1) * T + T / 2), y1: Math.min(h, (y1 + 1) * T + T / 2),
    }
    /* Un bandeau de titre est large et bas. Une photo est grande ; une lettre
       épaisse du nom, en gros et en couleur, est presque carrée — la relire
       inversée donne « A » ou « N » avec une belle confiance, et ce serait une
       initiale de plus dans le bandeau d'identité. */
    const zw = z.x1 - z.x0, zh = z.y1 - z.y0
    if (zw < 100 || zh > 140 || zw / zh < 2) continue
    zones.push(z)
  }
  return zones
}

/** Tous les bandeaux inversés, empilés dans une seule image : chaque appel au
    moteur coûte une seconde d'amorçage, quelle que soit la taille. */
export function empile(canvas: HTMLCanvasElement, zones: Zone[]): { c: HTMLCanvasElement; decalages: number[] } {
  const PAD = 16
  const c = document.createElement('canvas')
  c.width = Math.max(...zones.map((z) => z.x1 - z.x0)) + 2 * PAD
  c.height = zones.reduce((s, z) => s + (z.y1 - z.y0) + PAD, PAD)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  const decalages: number[] = []
  let y = PAD
  for (const z of zones) {
    ctx.drawImage(inverse(canvas, z), PAD, y)
    decalages.push(y)
    y += (z.y1 - z.y0) + PAD
  }
  return { c, decalages }
}

/** Une zone, découpée et inversée : le blanc sur bleu devient du noir sur
    blanc, ce que le moteur sait lire. */
export function inverse(canvas: HTMLCanvasElement, z: Zone): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = z.x1 - z.x0
  c.height = z.y1 - z.y0
  const ctx = c.getContext('2d')!
  ctx.drawImage(canvas, z.x0, z.y0, c.width, c.height, 0, 0, c.width, c.height)
  const im = ctx.getImageData(0, 0, c.width, c.height)
  const d = im.data
  for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]!; d[i + 1] = 255 - d[i + 1]!; d[i + 2] = 255 - d[i + 2]! }
  ctx.putImageData(im, 0, 0)
  return c
}

interface Mot { t: string; x0: number; y0: number; x1: number; y1: number; ly: number; c: number }

/** Les mots d'un résultat Tesseract, avec l'ordonnée de leur ligne. */
function mots(data: Tesseract.Page, minConf: number): Mot[] {
  const out: Mot[] = []
  for (const b of data.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        /* L'ordonnée vient de la LIGNE : « page » et « ana » n'ont pas la même
           boîte, et le regroupement à trois points les séparerait. La hauteur,
           elle, reste celle du mot — la boîte d'une ligne penchée qui traverse
           deux colonnes ne mesure rien. */
        const ly = (l.bbox.y0 + l.bbox.y1) / 2
        for (const m of l.words) {
          const t = m.text.trim()
          if (!t || m.confidence < minConf) continue
          out.push({ t, ...m.bbox, ly, c: m.confidence })
        }
      }
    }
  }
  return out
}

const chevauche = (a: Mot, b: Mot) =>
  Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0

const lettres = (t: string) => (t.match(/[A-Za-zÀ-ÿ]/g) ?? []).length

/** Une relecture ne s'ajoute que si elle ne recouvre rien — ou si ce qu'elle
    recouvre est moins sûr et moins lisible qu'elle : « DARKAM » à 92 % prend
    la place du « 1} » que la première passe avait lu au même endroit. */
function fusionne(liste: Mot[], r: Mot): void {
  const dessous = liste.filter((x) => chevauche(x, r))
  if (dessous.some((x) => x.c >= r.c || lettres(x.t) >= lettres(r.t))) return
  for (const x of dessous) liste.splice(liste.indexOf(x), 1)
  liste.push(r)
}

export async function litImage(source: Blob | HTMLCanvasElement, avance?: Avancement): Promise<PageOCR> {
  const canvas = await prepare(source)
  const w = await moteur(avance)
  // rotateAuto redresse une photo de travers ; les boîtes reviennent dans le
  // repère de l'image redressée, ce qui est ce qu'on veut.
  await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO })
  const { data } = await w.recognize(canvas, { rotateAuto: true }, { blocks: true, text: false })
  /* Un mot à 10 % de confiance est du bruit qu'on ne veut pas voir devenir un
     prénom. On coupe bas : les règles d'après savent ignorer. */
  const liste = mots(data, 20)

  /* Les titres de rubrique sont souvent en blanc sur un bandeau de couleur,
     et le moteur lit mal le clair sur sombre : « OLARITÉ », ou rien du tout.
     Sans la rubrique, tout le bloc des diplômes devient des expériences. On
     relit chaque zone sombre inversée, en bloc, et on garde ce qui est net. */
  const bandeaux = zonesSombres(canvas).slice(0, 16)
  if (bandeaux.length) {
    const { c, decalages } = empile(canvas, bandeaux)
    await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK })
    const relu = await w.recognize(c, {}, { blocks: true, text: false })
    for (const m of mots(relu.data, 70)) {
      if (!/[A-Za-zÀ-ÿ]{3,}/.test(m.t)) continue
      // À quel bandeau appartient ce mot ? Au dernier dont le haut est au-dessus.
      let k = 0
      for (let i = 0; i < decalages.length; i++) if (m.ly >= decalages[i]!) k = i
      const z = bandeaux[k]!, dy = z.y0 - decalages[k]!, dx = z.x0 - 16
      const r: Mot = { ...m, x0: m.x0 + dx, x1: m.x1 + dx, y0: m.y0 + dy, y1: m.y1 + dy, ly: m.ly + dy }
      fusionne(liste, r)
    }
  }

  /* Le nom, en très gros, dans un bandeau coloré ou à côté d'une photo : la
     segmentation automatique le prend pour un dessin et le saute, et le moteur
     lit mal des lettres de 70 px — il est fait pour du texte de corps. Une
     seconde passe en « texte épars » sur le tiers haut, RÉDUIT de moitié puis à
     taille réelle, le rattrape. On ne garde que ce qui ne recouvre rien de déjà
     lu, et seulement si c'est net. */
  await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT })
  const bande = Math.round(canvas.height * 0.35)
  for (const k of [0.5, 1]) {
    const c = document.createElement('canvas')
    c.width = Math.round(canvas.width * k)
    c.height = Math.round(bande * k)
    c.getContext('2d')!.drawImage(canvas, 0, 0, canvas.width, bande, 0, 0, c.width, c.height)
    const haut = await w.recognize(c, {}, { blocks: true, text: false })
    for (const m of mots(haut.data, 60)) {
      const r: Mot = { ...m, x0: m.x0 / k, x1: m.x1 / k, y0: m.y0 / k, y1: m.y1 / k, ly: m.ly / k }
      if (r.y1 - r.y0 < 12 || !/[A-Za-zÀ-ÿ]{2,}/.test(r.t)) continue
      fusionne(liste, r)
    }
  }

  const frags: Fragment[] = []
  let somme = 0, poids = 0
  const hauteurs = liste.map((m) => m.y1 - m.y0).sort((a, b) => a - b)
  const mediane = hauteurs[Math.floor(hauteurs.length / 2)] ?? 0
  for (const m of liste) {
    const h = m.y1 - m.y0
    if (h < 4) continue                        // un artefact de trame, pas une lettre
    /* Un pictogramme lu comme « © », « | » ou « Q » en très grand deviendrait
       le nom : un signe deux fois plus haut que le texte doit avoir deux
       lettres pour compter. */
    if (h > mediane * 2 && !/[A-Za-zÀ-ÿ0-9]{2,}/.test(m.t)) continue
    if (!/[A-Za-zÀ-ÿ0-9]/.test(m.t)) continue
    /* Et un mot bien plus grand que le corps, lu avec peine (« Das » à 25 %
       sous une icône), n'a rien à faire dans le bandeau d'identité. */
    if (h > mediane * 1.8 && m.c < 60) continue
    /* Un nom fait deux à trois fois le corps de texte. Dix fois, c'est un
       cercle décoratif ou une photo lue comme « ve » — et il deviendrait le
       seul candidat au bandeau d'identité. */
    if (mediane && h > mediane * 5) continue
    frags.push({ t: m.t, x: m.x0, w: m.x1 - m.x0, h: Math.round(h), y: Math.round(canvas.height - m.ly) })
    somme += m.c * m.t.length
    poids += m.t.length
  }
  return {
    frags, largeur: canvas.width, hauteur: canvas.height,
    confiance: poids ? Math.round(somme / poids) : 0,
  }
}
