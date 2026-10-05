/* Mon compte : l'adresse et le mot de passe, tenus par l'API de l'équipe.

   Ce qu'elle permet : changer de mot de passe par un code envoyé à l'adresse
   du compte (forgot-password puis reset-password), le même parcours que « mot
   de passe oublié » à la connexion, lancé d'ici sans retaper son adresse.
   Changer d'adresse n'existe pas chez eux : l'écran le dit, sans promesse. */

import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'

export function MonCompte() {
  const [email, setEmail] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const [codeEnvoye, setCodeEnvoye] = useState(false)
  const [code, setCode] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => { void api.moi().then((u) => setEmail(u?.email ?? '')) }, [])

  const ferme = () => { setOuvert(false); setCodeEnvoye(false); setCode(''); setNouveau(''); setErreur(null) }

  const agit = async (geste: () => Promise<void>, echec: string) => {
    setErreur(null); setInfo(null); setEnvoi(true)
    try {
      await geste()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : echec)
    } finally { setEnvoi(false) }
  }

  const demandeCode = () => void agit(async () => {
    await api.oubli(email)
    setCodeEnvoye(true)
  }, 'Le code n’a pas pu être envoyé. Réessaie dans un instant.')

  const confirme = (e: React.FormEvent) => {
    e.preventDefault()
    void agit(async () => {
      await api.oubliConfirme(code.trim(), nouveau)
      setInfo('Mot de passe changé. Utilise-le à ta prochaine connexion.')
      ferme()
    }, 'Le changement n’a pas abouti.')
  }

  return (
    <section className="mcompte">
      <h3>Mon compte</h3>
      <dl className="mc-ligne">
        <dt>Adresse e-mail</dt>
        <dd>{email || <Spinner />}</dd>
      </dl>

      {!ouvert && (
        <>
          {email && (
            <div className="mc-actions">
              <button className="btn-mini" onClick={() => { ferme(); setOuvert(true) }}>Changer mon mot de passe</button>
            </div>
          )}
          <p className="pa">
            Changer d’adresse n’est pas possible pour l’instant : c’est le service de comptes
            de l’équipe qui la détient, et il ne le permet pas.
          </p>
        </>
      )}

      {info && <div className="pal ok"><b>C’est fait</b>{info}</div>}

      {ouvert && !codeEnvoye && (
        <div className="pform mc-form">
          <p className="pa">
            On envoie un code à <b>{email}</b>. Il sert à choisir ton nouveau mot de passe, juste ici.
          </p>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <div className="mc-actions">
            <button className="btn primaire" type="button" disabled={envoi} onClick={demandeCode}>
              {envoi ? <><Spinner />Envoi…</> : 'Recevoir le code'}
            </button>
            <button className="btn" type="button" onClick={ferme}>Annuler</button>
          </div>
        </div>
      )}

      {ouvert && codeEnvoye && (
        <form className="pform mc-form" onSubmit={confirme}>
          <p className="pa">Code envoyé à <b>{email}</b>. Pense à regarder dans les indésirables.</p>
          <label className="pf">
            <span className="pl">Code reçu</span>
            <input type="text" value={code} required autoComplete="one-time-code"
              onChange={(e) => setCode(e.target.value)} />
          </label>
          <label className="pf">
            <span className="pl">Nouveau mot de passe</span>
            <input type="password" value={nouveau} required minLength={12} autoComplete="new-password"
              onChange={(e) => setNouveau(e.target.value)} />
            <span className="pa">Douze caractères au minimum.</span>
          </label>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <div className="mc-actions">
            <button className="btn primaire" type="submit" disabled={envoi}>
              {envoi ? <><Spinner />Un instant…</> : 'Changer le mot de passe'}
            </button>
            <button className="btn-mini" type="button" disabled={envoi} onClick={demandeCode}>Renvoyer un code</button>
            <button className="btn" type="button" onClick={ferme}>Annuler</button>
          </div>
        </form>
      )}
    </section>
  )
}
