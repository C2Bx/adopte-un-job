/* Mon CV : le fichier, déposé dans l'API de l'équipe (plus rien chez nous).

   UN SEUL CV par personne : leur API range le fichier sous `cv_<id>.pdf` ou
   `.jpg`, et un nouveau dépôt remplace l'ancien. PDF, PNG ou JPEG seulement.

   La lecture (le traitement n8n de Florian) REMPLACE le profil chez eux. La
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

const ko = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.round(n / 1024)} ko`)
const jour = (d: string) => {
  const t = new Date(d)
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}
const FORMATS = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg'

type Lecture = 'repos' | 'en_cours' | 'faite' | 'gardee' | 'echec'

export function useMesCV(onProfilLu?: () => void) {
  const [actif, setActif] = useState<CvInfo | null>(null)
  const [pret, setPret] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [lecture, setLecture] = useState<Lecture>('repos')

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
      setLecture(lance ? 'faite' : 'gardee')
      if (lance) onProfilLu?.()
      await charge()
    } catch (e) {
      setLecture('echec')
      setErreur(e instanceof ErreurApi ? e.message : 'La lecture du CV a échoué.')
    }
  }

  const ouvre = async () => {
    // la fenêtre s'ouvre tout de suite, sinon le navigateur la bloque après l'attente
    const w = window.open('', '_blank')
    try {
      const url = await api.urlFichierCV()
      if (w) w.location.href = url
      else window.location.href = url
    } catch (e) {
      w?.close()
      setErreur(e instanceof ErreurApi ? e.message : 'Le fichier n’a pas pu être ouvert.')
    }
  }

  return { pret, actif, erreur, envoi, lecture, depose, ouvre }
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
        tout seul à partir de lui : tu relis et tu corriges. Un Word : enregistre-le
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
    repos: c?.lecture ? 'ton profil a été rempli à partir de lui'
      : 'joint à tes candidatures ; ta saisie n’est jamais remplacée par la lecture',
  }[cv.lecture]
  return (
    <section className="mescv-zone" aria-label="Mon CV déposé">
      <div className="mescv-zone-tete">
        <h3>Mon CV déposé</h3>
        <span className="pa">Un seul CV : en déposer un autre remplace celui-ci.</span>
      </div>
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
