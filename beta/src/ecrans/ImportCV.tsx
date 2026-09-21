/* Import de CV. Deux écrans : le dépôt, puis la relecture.
   L'extraction ne remplit rien toute seule — on montre ce qui a été lu, avec
   l'extrait du CV d'où ça vient, et l'utilisateur décoche ce qui est faux. Une
   lecture automatique se trompe, et un profil faux est pire qu'un profil vide. */

import { useState } from 'react'
import { api } from '../api'
import type { Extraction, Trouvaille } from '../extraction'
import { NIVEAUX } from '../regles'
import type { Profil } from '../types'

const LIB: Record<string, string> = {
  prenom: 'Prénom', initiale: 'Initiale du nom', email: 'Adresse e-mail',
  telephone: 'Téléphone', formation: 'Niveau de formation',
  experiences: 'Expériences', formations: 'Formations',
  competences: 'Compétences', langues: 'Langues', permis: 'Permis B',
}

function joli(cle: string, v: unknown): string {
  if (cle === 'formation') return NIVEAUX[v as number] ?? String(v)
  if (cle === 'permis') return v ? 'oui' : 'non'
  if (cle === 'competences') return (v as string[]).join(' · ')
  if (cle === 'langues') return (v as { langue: string; niveau: string }[])
    .map((l) => `${l.langue} ${l.niveau}`).join(' · ')
  if (cle === 'experiences') return (v as { poste: string; debut: string; fin: string }[])
    .map((e) => `${e.poste || 'poste non identifié'} (${e.debut}${e.fin && e.fin !== e.debut ? `–${e.fin}` : ''})`)
    .join(' · ')
  if (cle === 'formations') return (v as { niveau: number; domaine: string }[])
    .map((f) => `${f.domaine || 'formation'} — ${NIVEAUX[f.niveau] ?? '?'}`).join(' · ')
  return String(v)
}

/** Ces champs n'ont pas d'extrait : leur justificatif est une explication,
    et « lu dans » serait alors un mensonge de libellé. */
const LISTES = new Set(['experiences', 'formations', 'competences', 'langues'])

type Etat =
  | { phase: 'repos' }
  | { phase: 'lecture'; nom: string; etape: string; fraction: number }
  | { phase: 'erreur'; message: string }

/** En dessous, une lecture optique a trop douté pour qu'on coche à sa place :
    tout est proposé, rien n'est retenu d'office. */
const CONFIANCE_MIN = 70

const ACCEPTE = '.pdf,image/*,.jpg,.jpeg,.png,.webp'

interface Props {
  profil: Profil
  onProfil: (p: Profil) => void
  /** Prévient l'écran parent qu'une relecture est en cours : le formulaire doit
      s'effacer, sinon on peut le modifier pendant qu'une relecture attend. */
  onRelecture: (ouverte: boolean) => void
}

export function ImportCV({ profil, onProfil, onRelecture }: Props) {
  const [etat, setEtat] = useState<Etat>({ phase: 'repos' })
  const [extrait, setExtrait] = useState<Extraction | null>(null)
  const [retenus, setRetenus] = useState<Set<string>>(new Set())

  const depose = async (f: File) => {
    const pdf = /\.pdf$/i.test(f.name) || f.type === 'application/pdf'
    const image = /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|tiff?)$/i.test(f.name)
    if (!pdf && !image) {
      setEtat({ phase: 'erreur', message: 'Ce format n’est pas lu. Un PDF, une photo ou un scan (JPG, PNG) — ou le formulaire, qui reste le chemin le plus fiable.' })
      return
    }
    if (/\.hei[cf]$/i.test(f.name)) {
      setEtat({ phase: 'erreur', message: 'Les photos HEIC ne sont pas lisibles ici. Sur iPhone, choisis « Plus compatible » dans Réglages › Appareil photo › Formats, ou exporte en JPG.' })
      return
    }
    if (f.size > 25 * 1024 * 1024) {
      setEtat({ phase: 'erreur', message: 'Fichier trop lourd (25 Mo maximum).' })
      return
    }
    setEtat({ phase: 'lecture', nom: f.name, etape: 'ouverture', fraction: 0 })
    try {
      /* pdf.js pèse un mégaoctet, l'OCR bien plus : ils ne sont téléchargés
         qu'au moment où quelqu'un dépose vraiment un CV, pas à l'ouverture. */
      const { litCV } = await import('../extraction')
      const r = await litCV(f, (etape, fraction) => setEtat({ phase: 'lecture', nom: f.name, etape, fraction }))
      if (r.vide) {
        setEtat({ phase: 'erreur', message: r.mode === 'ocr'
          ? 'Aucun texte reconnu sur cette image. Une photo bien à plat, sans ombre, cadrée sur la page, se lit mieux — ou exporte le CV en PDF.'
          : 'Ce PDF ne contient aucun texte lisible.' })
        return
      }
      setExtrait(r)
      onRelecture(true)
      /* Une lecture optique qui a douté ne coche rien : l'utilisateur relit
         tout, et ce qu'il n'a pas coché n'entre pas. */
      const sur = r.mode === 'texte' || (r.confiance ?? 0) >= CONFIANCE_MIN
      setRetenus(new Set(sur ? Object.keys(r.trouve) : []))
      setEtat({ phase: 'repos' })
      void api.deposeCV({
        nom: f.name, mime: f.type || (pdf ? 'application/pdf' : 'image/*'), octets: f.size,
        moteur: r.mode === 'ocr' ? 'tesseract' : 'pdfjs',
        version: r.mode === 'ocr' ? '6.0.1' : '6.3.289',
        brut: { ...r.trouve, _confiance: r.confiance }, retenu: {},
      }).catch(() => { /* le dépôt du journal ne doit pas bloquer la relecture */ })
    } catch (e) {
      setEtat({ phase: 'erreur', message: e instanceof Error ? e.message : 'Lecture impossible.' })
    }
  }

  const valide = () => {
    if (!extrait) return
    const t = extrait.trouve as Record<string, unknown>
    const p: Profil = { ...profil }
    for (const cle of retenus) {
      const v = t[cle]
      if (v === undefined) continue
      if (cle === 'formations') {
        p.formations = v as Profil['formations']
        p.formation = Math.max(...p.formations.map((f) => f.niveau || 1))
      } else if (cle === 'formation') {
        if (!p.formations.length) p.formation = v as number
      } else if (cle === 'email') {
        continue                                  // l'adresse du compte fait foi
      } else {
        // @ts-expect-error affectation dynamique, les clés viennent de Trouvaille
        p[cle] = v
      }
    }
    onProfil(p)
    setExtrait(null)
    onRelecture(false)
  }

  if (extrait) {
    const cles = Object.keys(extrait.trouve) as (keyof Trouvaille)[]
    return (
      <>
        <h2>Ce qu’on a lu dans ton CV</h2>
        <p className="lead">
          Rien n’est appliqué tant que tu n’as pas validé. Décoche ce qui est faux :
          une lecture automatique se trompe, et c’est normal.
        </p>
        {extrait.mode === 'ocr' && (
          <div className={`pal ${(extrait.confiance ?? 0) >= CONFIANCE_MIN ? 'info' : 'manque'}`}>
            <b>Lu par reconnaissance de caractères — confiance {extrait.confiance ?? 0} %</b>
            {(extrait.confiance ?? 0) >= CONFIANCE_MIN
              ? 'Une image se lit moins bien qu’un PDF : vérifie les chiffres et les noms propres avant de valider.'
              : 'Lecture incertaine : rien n’est coché d’office. Coche ce qui est juste, ou reprends une photo bien à plat, sans ombre.'}
          </div>
        )}
        <div className="prelu">
          {cles.map((k) => (
            <label className="plu" key={k}>
              <input
                type="checkbox"
                checked={retenus.has(k)}
                onChange={(e) => {
                  const s = new Set(retenus)
                  if (e.target.checked) s.add(k); else s.delete(k)
                  setRetenus(s)
                }}
              />
              <span>
                <b>{LIB[k] ?? k}</b>
                {joli(k, extrait.trouve[k])}
                {/* Répéter la valeur en guise de justificatif n'aide personne. */}
                {extrait.sources[k] && extrait.sources[k] !== joli(k, extrait.trouve[k]) && (
                  <cite>{LISTES.has(k) ? '' : 'lu dans : '}{extrait.sources[k]}</cite>
                )}
              </span>
            </label>
          ))}
        </div>
        <div className="pal info" style={{ marginTop: 'var(--s4)' }}>
          <b>Ce qui n’est pas déduit</b>
          Les métiers que tu vises, tes zones acceptées et ton contrat souhaité ne sont
          pas dans un CV : il décrit ton passé, pas ton projet. Tu les renseignes juste après.
        </div>
        <div className="pnav">
          <button className="btn-mini" onClick={() => { setExtrait(null); onRelecture(false) }}>Annuler</button>
          <button className="btn-fort" onClick={valide}>Valider et continuer</button>
        </div>
      </>
    )
  }

  return (
    <div className="pimport">
      <div className="pvoie">
        <b>J’ai un CV</b>
        <span>
          Dépose un PDF, une photo ou un scan : il est lu dans l’appareil, rien n’est
          envoyé. Tu relis ensuite ce qui a été trouvé, champ par champ.
        </span>
        <label className="btn-fichier">
          Choisir un fichier
          <input
            type="file" accept={ACCEPTE} hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void depose(f) }}
          />
        </label>
        {etat.phase === 'lecture' && (
          <em role="status">
            {etat.etape === 'ouverture' ? 'Lecture' : `Lecture optique — ${etat.etape}`} de {etat.nom}
            {etat.etape !== 'ouverture' && ` · ${Math.round(etat.fraction * 100)} %`}
          </em>
        )}
        {etat.phase === 'erreur' && <em>{etat.message}</em>}
      </div>
      <div className="pvoie">
        <b>Je pars de zéro</b>
        <span>
          Le formulaire ci-dessous, étape par étape. C’est le chemin principal, pas la
          solution de repli : ce que tu vises n’est écrit dans aucun CV.
        </span>
      </div>
    </div>
  )
}
