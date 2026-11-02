/* Mon CV : le fichier, déposé dans l'API de l'équipe (plus rien chez nous).

   UN SEUL CV par personne : leur API range le fichier sous `cv_<id>.pdf` ou
   `.jpg`, et un nouveau dépôt remplace l'ancien. PDF, PNG ou JPEG seulement.

   La lecture n8n arrive dans cvJsonGenere, séparément du profil validé. La
   règle est de ne jamais écraser ce que la personne a saisi : on ne la lance
   donc que si le parcours est vide. Sinon le CV est joint, la saisie reste, et
   l'écran le dit. Leur route attend la fin de la lecture : jusqu'à 3 minutes.

   Trois morceaux, un seul état (`useMesCV`, appelé une fois dans l'écran
   Profil) : CarteCV (à côté des deux autres façons de remplir son profil),
   ZoneCV (le fichier, son état, Ouvrir), MesCV (les deux, en mode formulaire). */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { CvInfo } from '../types'
import { ApercuDocument, champsDocument } from './RelectureDocument'

const ko = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.round(n / 1024)} ko`)
const jour = (d: string) => {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
const FORMATS = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'

type Lecture = 'a_valider' | 'repos' | 'en_cours' | 'faite' | 'gardee' | 'echec'

export function useMesCV(onProfilLu?: () => void, avantOperation?: () => Promise<void>) {
  const [actif, setActif] = useState<CvInfo | null>(null)
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [lecture, setLecture] = useState<Lecture>('repos')
  const [apercu, setApercu] = useState<{ courant: Record<string, unknown>; extrait: Record<string, unknown> } | null>(null)
  const [choix, setChoix] = useState<string[]>([])
  const [validation, setValidation] = useState(false)

  const charge = useCallback(async () => {
    try {
      setActif((await api.cvs()).actif)
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Ton CV n’a pas pu être lu.')
    } finally {
      setPret(true)
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  const depose = async (f: File) => {
    setErreur(null)
    setEnvoi(true)
    try {
      await avantOperation?.()
      setActif(await api.deposeFichierCV(f))
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Le fichier n’a pas pu être déposé.')
      setEnvoi(false)
      return
    }
    setEnvoi(false)
    setLecture('en_cours')
    try {
      const lance = await api.lisCV()
      setLecture(lance ? 'a_valider' : 'gardee')
      if (lance) { const d = await api.apercuLectureCV(); setApercu(d); setChoix(champsDocument(d.extrait).map((x) => x.chemin)) }
      await charge()
    } catch (e) {
      setLecture('echec')
      setErreur(e instanceof ErreurApi ? e.message : 'La lecture du CV a échoué.')
    }
  }

  const relire = async () => {
    setErreur(null)
    try {
      await avantOperation?.()
      const d = await api.apercuLectureCV()
      const champs = champsDocument(d.extrait)
      if (!champs.length) throw new Error('Aucune extraction enregistrée n’est disponible pour ce profil.')
      setApercu(d); setChoix(champs.map((x) => x.chemin)); setLecture('a_valider')
    } catch (e) { setErreur(e instanceof Error ? e.message : 'L’aperçu est indisponible.') }
  }

  const valide = async () => {
    if (!apercu || validation) return
    setValidation(true); setErreur(null)
    try {
      await avantOperation?.()
      await api.valideLectureCV(choix, apercu.extrait)
      setApercu(null); setLecture('faite'); onProfilLu?.(); await charge()
    } catch (e) { setErreur(e instanceof Error ? e.message : 'La lecture n’a pas pu être intégrée.') }
    finally { setValidation(false) }
  }

  const ouvre = async () => {
    // la fenêtre s'ouvre tout de suite, sinon le navigateur la bloque après l'attente
    const w = window.open('', '_blank')
    if (w) w.opener = null
    try {
      const url = await api.urlFichierCV()
      if (w) w.location.href = url
      else window.location.href = url
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      w?.close()
      setErreur(e instanceof ErreurApi ? e.message : 'Le fichier n’a pas pu être ouvert.')
    }
  }

  return { pret, actif, erreur, envoi, lecture, depose, ouvre, apercu, choix, setChoix, valide, relire, validation, ignore: () => { setApercu(null); setLecture('gardee') } }
}

export type EtatCV = ReturnType<typeof useMesCV>

function BoutonDepot({ cv }: { cv: EtatCV }) {
  const occupe = cv.envoi || cv.lecture === 'en_cours'
  return (
    <label className="btn-fichier">
      {cv.envoi ? <><Spinner />Envoi…</> : cv.actif ? 'Remplacer mon CV' : 'Déposer mon CV'}
      <input type="file" hidden disabled={occupe} accept={FORMATS}
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void cv.depose(f) }} />
    </label>
  )
}

/* La carte, à côté des deux autres façons de remplir son profil. */
export function CarteCV({ cv }: { cv: EtatCV }) {
  return (
    <div className="qzcarte mescv-carte">
      <h3>Mon CV</h3>
      <p>
        PDF ou photo (PNG, JPEG). S’il n’y a encore rien dans ton profil, il se remplit
        à partir des champs extraits que tu relis et valides. Un Word : enregistre-le
        d’abord en PDF.
      </p>
      {cv.erreur && <div className="pal manque"><b>Problème</b>{cv.erreur}</div>}
      {cv.pret && <BoutonDepot cv={cv} />}
    </div>
  )
}

/* Le fichier déposé : une zone à lui, sous les trois cartes. */
export function ZoneCV({ cv }: { cv: EtatCV }) {
  const c = cv.actif
  if (!cv.pret || (!c && cv.lecture === 'repos')) return null
  const etat = cv.lecture === 'en_cours' ? 'attente' : c?.lecture || cv.lecture === 'faite' ? 'lu' : 'pas-lu'
  const phrase = {
    en_cours: 'lecture en cours : jusqu’à 3 minutes, ne ferme pas la page',
    faite: 'ton profil a été rempli à partir de lui : relis-le et corrige',
    gardee: 'ton profil était déjà rempli : ta saisie est gardée, le CV est joint à tes candidatures',
    echec: 'la lecture a échoué : remplis ton profil à la main ou par les questions',
    a_valider: 'lecture prête : vérifie les champs avant de les intégrer',
    repos: c?.lecture ? 'ton profil a été rempli à partir de lui'
      : 'joint à tes candidatures ; ta saisie n’est jamais remplacée par la lecture',
  }[cv.lecture]
  return (
    <section className="mescv-zone" aria-label="Mon CV déposé">
      <div className="mescv-zone-tete">
        <h3>Mon CV déposé</h3>
        <span className="pa">Un seul CV : en déposer un autre remplace celui-ci.</span>
      </div>
      {cv.apercu && <div className="upgrade-relecture-cv">
        <h3>Relire les champs extraits du CV</h3>
        <p>Décoche ce que tu ne veux pas reprendre. Vérifie que cette dernière lecture enregistrée correspond bien à ton document actuel : elle peut être plus ancienne. Les champs déjà renseignés restent prioritaires ; seules les absences seront complétées.</p>
        <ApercuDocument document={cv.apercu.extrait} avant={cv.apercu.courant} selection={cv.choix} onSelection={cv.setChoix} />
        <button className="btn primaire" disabled={!cv.choix.length || cv.validation} onClick={() => void cv.valide()}>Intégrer les champs sélectionnés</button>
        <button className="btn" disabled={cv.validation} onClick={cv.ignore}>Garder mon profil actuel</button>
      </div>}
      <div className="mescv-fichier">
        <span className={`mescv-etat ${etat}`}>
          {etat === 'attente' ? <><Spinner />Lecture en cours</> : etat === 'lu' ? 'Lu' : 'Joint'}
        </span>
        <span className="mescv-nom">
          <b>{c?.nom ?? 'Ton CV'}</b>
          <em>
            {c && c.octets > 0 && `${ko(c.octets)} · `}
            {c && jour(c.depose) && `déposé le ${jour(c.depose)} · `}
            {phrase}
          </em>
        </span>
        {c && (
          <span className="mescv-btns">
            <button type="button" className="btn-mini" onClick={() => void cv.ouvre()}>Ouvrir</button>
            <button type="button" className="btn-mini" disabled={cv.lecture === 'en_cours' || cv.validation} onClick={() => void cv.relire()}>Relire la dernière extraction enregistrée</button>
          </span>
        )}
      </div>
    </section>
  )
}

/* Les deux réunis, en mode formulaire. */
export function MesCV({ cv }: { cv: EtatCV }) {
  if (!cv.pret) return null
  return (
    <div className="pvoie mescv">
      <b>Mon CV</b>
      <span>
        PDF ou photo (PNG, JPEG). <b>Ta saisie n’est jamais remplacée</b> : la lecture
        automatique ne remplit que les profils encore vides. Un Word : enregistre-le
        d’abord en PDF.
      </span>
      {cv.erreur && <div className="pal manque"><b>Problème</b>{cv.erreur}</div>}
      <div className="mescv-actions"><BoutonDepot cv={cv} /></div>
      <ZoneCV cv={cv} />
    </div>
  )
}
