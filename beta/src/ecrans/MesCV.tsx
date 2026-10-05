/* Mon CV : le fichier déposé, chiffré sur le serveur. Un seul est « actif » :
   c'est lui qui part avec une candidature, et c'est lui que la chaîne
   d'extraction lit pour remplir le profil.

   L'écran ne dit de tout cela que ce qui change quelque chose pour la
   personne : que son format passe, qu'elle n'aura rien à recopier, et que ce
   n'est pas instantané — sans cette dernière phrase, un profil qui ne bouge
   pas dans la minute passe pour une panne. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { CvInfo } from '../types'

const ko = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.round(n / 1024)} ko`)

/* `carte` : la même chose en carte, à côté de « Je pars de zéro » et
   « Affiner par questions » — les trois façons de remplir son profil. */
export function MesCV({ carte = false }: { carte?: boolean }) {
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

  const depose = async (f: File) => {
    setErreur(null)
    setEnvoi(true)
    try {
      const actif = cvs?.find((c) => c.actif)
      await api.deposeFichierCV(f, actif?.id)
      await charge()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Le fichier n’a pas pu être déposé.')
    } finally {
      setEnvoi(false)
    }
  }

  const supprime = async (c: CvInfo) => {
    if (!window.confirm(`Supprimer « ${c.nom} » et son fichier ?`)) return
    try {
      await api.supprimeCV(c.id)
      await charge()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.')
    }
  }



  if (cvs === null) return null
  const actif = cvs.find((c) => c.actif) ?? null

  return (
    <div className={carte ? 'qzcarte mescv-carte' : 'pvoie mescv'}>
      {carte ? <h3>Mon CV</h3> : <b>Mon CV</b>}
      {carte ? (
        <p>
          PDF, Word, photo… peu importe le format. Ton profil se remplit tout seul à
          partir de lui : tu relis et tu corriges. Compte quelques minutes, tu peux
          fermer la page.
        </p>
      ) : (
        <span>
          PDF, Word, photo… peu importe le format. <b>Ton profil se remplit tout seul</b>
          à partir de lui : tu n’as rien à recopier, tu relis et tu corriges.
          Compte quelques minutes — tu peux fermer la page, ça continue sans toi.
        </span>
      )}

      {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

      <div className="mescv-actions">
        <label className="btn-fichier">
          {envoi ? <><Spinner />Envoi…</> : actif?.fichier ? 'Remplacer mon CV' : 'Déposer mon CV'}
          <input type="file" hidden disabled={envoi}
            accept=".pdf,.doc,.docx,.odt,.rtf,.txt,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void depose(f) }} />
        </label>
      </div>

      {cvs.length > 0 && (
        <ul className="mescv-liste">
          {cvs.map((c) => (
            <li key={c.id} className={c.actif ? 'on' : ''}>
              <span>
                <b>{c.nom}</b>
                <em>
                  {ko(c.octets)}
                  {c.actif && (c.lecture
                    ? ' · profil rempli à partir de ce CV'
                    : ' · lecture en cours…')}
                </em>
              </span>
              <span className="mescv-btns">
                {c.fichier && <a className="btn-mini" href={api.urlFichierCV(c.id)} target="_blank" rel="noreferrer">Ouvrir</a>}
                <button type="button" className="btn-mini" onClick={() => void supprime(c)}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
