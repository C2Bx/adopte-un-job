/* Mon CV : le fichier déposé, chiffré sur le serveur.

   UN SEUL CV par personne. Déposer un nouveau fichier REMPLACE l'ancien : il
   est effacé sur-le-champ, chez nous et dans l'espace d'échange où la chaîne
   d'extraction de l'équipe vient le lire. C'est lui qui part avec une
   candidature, et c'est lui qui remplit le profil. Plusieurs CV voudraient dire
   plusieurs profils extraits, et aucun moyen de savoir lequel est le bon.

   Supprimer efface vraiment : le fichier chiffré, sa lecture, et la copie de
   l'espace d'échange, sans attendre le passage suivant du veilleur. Le profil,
   lui, reste : c'est le sien, il le modifie à part.

   Trois morceaux, un seul état (`useMesCV`, appelé une fois dans l'écran
   Profil) :
     - CarteCV  : à côté de « Je pars de zéro » et « Affiner par questions » ;
     - ZoneCV   : le fichier lui-même, son état, Ouvrir et Supprimer ;
     - MesCV    : les deux réunis, quand l'écran est en mode formulaire.

   Les anciennes lectures faites dans le navigateur (avant le 29/09) n'ont pas
   de fichier : elles ne sont pas listées, elles partent avec le compte. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { CvInfo } from '../types'

const ko = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.round(n / 1024)} ko`)
const jour = (d: string) => {
  const t = new Date(d.replace(' ', 'T') + 'Z')
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export function useMesCV() {
  const [cvs, setCvs] = useState<CvInfo[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const charge = useCallback(async () => {
    try {
      setCvs((await api.cvs()).cv)
    } catch (e) {
      setCvs([])
      setErreur(e instanceof ErreurApi ? e.message : 'Liste indisponible.')
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  const fichiers = (cvs ?? []).filter((c) => c.fichier)
  const actif = fichiers.find((c) => c.actif) ?? fichiers[0] ?? null

  const depose = async (f: File) => {
    setErreur(null)
    setEnvoi(true)
    try {
      await api.deposeFichierCV(f, actif?.id)
      await charge()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Le fichier n’a pas pu être déposé.')
    } finally {
      setEnvoi(false)
    }
  }

  const supprime = async (c: CvInfo) => {
    if (!window.confirm(`Supprimer « ${c.nom} » ?\n\nLe fichier est effacé de nos serveurs et de l’espace `
      + 'd’échange avec l’équipe. Ton profil, lui, reste tel quel.')) return
    setErreur(null)
    try {
      await api.supprimeCV(c.id)
      await charge()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.')
    }
  }

  return { pret: cvs !== null, fichiers, actif, erreur, envoi, depose, supprime }
}

export type EtatCV = ReturnType<typeof useMesCV>

function BoutonDepot({ cv }: { cv: EtatCV }) {
  return (
    <label className="btn-fichier">
      {cv.envoi ? <><Spinner />Envoi…</> : cv.actif ? 'Remplacer mon CV' : 'Déposer mon CV'}
      <input type="file" hidden disabled={cv.envoi}
        accept=".pdf,.doc,.docx,.odt,.rtf,.txt,image/*"
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
        PDF, Word, photo… peu importe le format. Ton profil se remplit tout seul à
        partir de lui : tu relis et tu corriges. Compte quelques minutes, tu peux
        fermer la page.
      </p>
      {cv.erreur && <div className="pal manque"><b>Problème</b>{cv.erreur}</div>}
      {cv.pret && <BoutonDepot cv={cv} />}
    </div>
  )
}

/* Le fichier déposé : une zone à lui, sous les trois cartes. */
export function ZoneCV({ cv }: { cv: EtatCV }) {
  const c = cv.actif
  if (!cv.pret || !c) return null
  return (
    <section className="mescv-zone" aria-label="Mon CV déposé">
      <div className="mescv-zone-tete">
        <h3>Mon CV déposé</h3>
        <span className="pa">Un seul CV : en déposer un autre remplace celui-ci.</span>
      </div>
      <div className="mescv-fichier">
        <span className={`mescv-etat ${c.lecture ? 'lu' : 'attente'}`}>
          {c.lecture ? 'Lu' : <><Spinner />Lecture en cours</>}
        </span>
        <span className="mescv-nom">
          <b>{c.nom}</b>
          <em>
            {ko(c.octets)}{jour(c.depose) && ` · déposé le ${jour(c.depose)}`}
            {c.lecture ? ' · ton profil a été rempli à partir de lui' : ' · ton profil se remplira tout seul'}
          </em>
        </span>
        <span className="mescv-btns">
          <a className="btn-mini" href={api.urlFichierCV(c.id)} target="_blank" rel="noreferrer">Ouvrir</a>
          <button type="button" className="btn-mini danger" onClick={() => void cv.supprime(c)}>Supprimer</button>
        </span>
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
        PDF, Word, photo… peu importe le format. <b>Ton profil se remplit tout seul</b>
        à partir de lui : tu n’as rien à recopier, tu relis et tu corriges.
        Compte quelques minutes — tu peux fermer la page, ça continue sans toi.
      </span>
      {cv.erreur && <div className="pal manque"><b>Problème</b>{cv.erreur}</div>}
      <div className="mescv-actions"><BoutonDepot cv={cv} /></div>
      <ZoneCV cv={cv} />
    </div>
  )
}
