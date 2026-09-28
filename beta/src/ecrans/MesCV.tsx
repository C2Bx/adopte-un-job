/* Mes CV : le fichier d'origine (chiffré sur le serveur, remis à l'employeur à
   la présélection), le résumé JSON lu dans l'appareil, le CV généré depuis le
   profil, et l'export JSON Resume. Un seul CV est « actif » : c'est lui qui
   part avec une candidature. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { CvInfo } from '../types'

const ko = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} Mo` : `${Math.round(n / 1024)} ko`)

export function MesCV() {
  const [cvs, setCvs] = useState<CvInfo[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  const [json, setJson] = useState<CvInfo | null>(null)

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

  const exporteJsonResume = async () => {
    try {
      const d = await api.jsonResume()
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'resume.json'
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Export impossible.')
    }
  }

  if (cvs === null) return null
  const actif = cvs.find((c) => c.actif) ?? null

  return (
    <div className="pvoie mescv">
      <b>Mon CV</b>
      <span>
        Dépose ton CV dans le format que tu as sous la main — <b>PDF, Word, OpenDocument,
        RTF, texte ou photo</b>. Il est chiffré sur le serveur, puis transmis à la chaîne
        d’analyse de l’équipe, qui en tire les rubriques et <b>remplit ce profil toute
        seule</b>. Tu n’as rien à recopier : tu relis, et tu corriges ce qui va de travers.
      </span>

      {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

      <div className="mescv-actions">
        <label className="btn-fichier">
          {envoi ? <><Spinner />Envoi…</> : actif?.fichier ? 'Remplacer mon CV' : 'Déposer mon CV'}
          <input type="file" hidden disabled={envoi}
            accept=".pdf,.doc,.docx,.odt,.rtf,.txt,image/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void depose(f) }} />
        </label>
        <a className="btn-mini" href={api.urlCvGenere()} target="_blank" rel="noreferrer">CV généré (PDF)</a>
        <button type="button" className="btn-mini" onClick={() => void exporteJsonResume()}>JSON Resume</button>
      </div>

      {cvs.length > 0 && (
        <ul className="mescv-liste">
          {cvs.map((c) => (
            <li key={c.id} className={c.actif ? 'on' : ''}>
              <span>
                <b>{c.nom}</b>
                <em>
                  {c.fichier ? `fichier ${ko(c.octets)}` : 'lecture seule, sans fichier'}
                  {c.lecture ? ` · lu par ${c.lecture.moteur} ${c.lecture.version}` : ''}
                  {c.actif ? ' · actif' : ''}
                </em>
              </span>
              <span className="mescv-btns">
                {c.fichier && <a className="btn-mini" href={api.urlFichierCV(c.id)} target="_blank" rel="noreferrer">Ouvrir</a>}
                {c.lecture && <button type="button" className="btn-mini" onClick={() => setJson(json?.id === c.id ? null : c)}>JSON</button>}
                <button type="button" className="btn-mini" onClick={() => void supprime(c)}>Supprimer</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {json?.lecture && (
        <pre className="mescv-json">{JSON.stringify(json.lecture.retenu ?? json.lecture.lu, null, 2)}</pre>
      )}
    </div>
  )
}
