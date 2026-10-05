/* Mon compte : l'adresse et le mot de passe.

   Ils ne sont pas à nous. Depuis le 29/09 c'est le service de comptes de
   l'équipe qui les détient. Ce qu'il permet au 05/10 :

   - changer de mot de passe, par un code envoyé à l'adresse du compte
     (forgot-password puis reset-password). C'est le même parcours que
     « mot de passe oublié » à la connexion, lancé d'ici sans retaper son
     adresse ;
   - PAS changer d'adresse : aucune route chez eux. L'écran le dit, sans
     promettre de date.

   Le jour où ils exposeront un vrai changement (`comptesModifiables`), les
   deux formulaires directs ci-dessous reprennent la main : ils redemandent le
   mot de passe courant, qui sert à obtenir un jeton frais auprès d'eux. */

import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'

type Ouvert = 'aucun' | 'motdepasse' | 'email' | 'code'

export function MonCompte() {
  const [email, setEmail] = useState('')
  const [modifiable, setModifiable] = useState<boolean | null>(null)
  const [parCode, setParCode] = useState(false)
  const [ouvert, setOuvert] = useState<Ouvert>('aucun')

  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [mdpConfirme, setMdpConfirme] = useState('')
  const [code, setCode] = useState('')
  const [codeEnvoye, setCodeEnvoye] = useState(false)

  const [envoi, setEnvoi] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void api.moi().then((u) => {
      setEmail(u?.email ?? '')
      setModifiable(u?.comptesModifiables ?? false)
    }).catch(() => setModifiable(false))
    void api.capacites().then(setParCode).catch(() => setParCode(false))
  }, [])

  const ferme = () => {
    setOuvert('aucun'); setErreur(null); setAncien(''); setNouveau(''); setNouvelEmail('')
    setMdpConfirme(''); setCode(''); setCodeEnvoye(false)
  }

  const agit = async (geste: () => Promise<void>, echec: string) => {
    setErreur(null); setInfo(null); setEnvoi(true)
    try {
      await geste()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : echec)
    } finally { setEnvoi(false) }
  }

  const changeMotDePasse = (e: React.FormEvent) => {
    e.preventDefault()
    void agit(async () => {
      await api.changeMotDePasse(ancien, nouveau)
      setInfo('Mot de passe changé. Tes autres sessions ont été fermées.')
      ferme()
    }, 'Le changement n’a pas abouti.')
  }

  const changeEmail = (e: React.FormEvent) => {
    e.preventDefault()
    void agit(async () => {
      const r = await api.changeEmail(nouvelEmail.trim(), mdpConfirme)
      setEmail(r.email)
      setInfo('Adresse changée. C’est elle qu’il faudra saisir à la prochaine connexion.')
      ferme()
    }, 'Le changement n’a pas abouti.')
  }

  const demandeCode = () => {
    void agit(async () => {
      await api.oubli(email)
      setCodeEnvoye(true)
    }, 'Le code n’a pas pu être envoyé. Réessaie dans un instant.')
  }

  const confirmeCode = (e: React.FormEvent) => {
    e.preventDefault()
    void agit(async () => {
      await api.oubliConfirme(code.trim(), nouveau)
      setInfo('Mot de passe changé. Utilise-le à ta prochaine connexion.')
      ferme()
    }, 'Le changement n’a pas abouti.')
  }

  const libre = ouvert === 'aucun'

  return (
    <section className="mcompte">
      <h3>Mon compte</h3>
      <dl className="mc-ligne">
        <dt>Adresse e-mail</dt>
        <dd>{email || <Spinner />}</dd>
      </dl>

      {modifiable && libre && (
        <div className="mc-actions">
          <button className="btn-mini" onClick={() => { ferme(); setOuvert('motdepasse') }}>Changer mon mot de passe</button>
          <button className="btn-mini" onClick={() => { ferme(); setOuvert('email') }}>Changer mon adresse</button>
        </div>
      )}

      {modifiable === false && libre && (
        <>
          {parCode && email && (
            <div className="mc-actions">
              <button className="btn-mini" onClick={() => { ferme(); setOuvert('code') }}>Changer mon mot de passe</button>
            </div>
          )}
          <p className="pa">
            Changer d’adresse n’est pas possible pour l’instant : c’est le service de comptes
            de l’équipe qui la détient, et il ne le permet pas.
          </p>
        </>
      )}

      {info && <div className="pal ok"><b>C’est fait</b>{info}</div>}

      {ouvert === 'code' && !codeEnvoye && (
        <div className="pform mc-form">
          <p className="pa">
            On envoie un code à <b>{email}</b>. Il sert à choisir ton nouveau mot de passe,
            juste ici.
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

      {ouvert === 'code' && codeEnvoye && (
        <form className="pform mc-form" onSubmit={confirmeCode}>
          <p className="pa">
            Code envoyé à <b>{email}</b>. Pense à regarder dans les indésirables.
          </p>
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

      {modifiable && ouvert === 'motdepasse' && (
        <form className="pform mc-form" onSubmit={changeMotDePasse}>
          <label className="pf">
            <span className="pl">Mot de passe actuel</span>
            <input type="password" value={ancien} required autoComplete="current-password"
              onChange={(e) => setAncien(e.target.value)} />
          </label>
          <label className="pf">
            <span className="pl">Nouveau mot de passe</span>
            <input type="password" value={nouveau} required minLength={12} autoComplete="new-password"
              onChange={(e) => setNouveau(e.target.value)} />
            <span className="pa">Douze caractères au minimum. Tes autres sessions seront fermées.</span>
          </label>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <div className="mc-actions">
            <button className="btn primaire" type="submit" disabled={envoi}>
              {envoi ? <><Spinner />Un instant…</> : 'Changer le mot de passe'}
            </button>
            <button className="btn" type="button" onClick={ferme}>Annuler</button>
          </div>
        </form>
      )}

      {modifiable && ouvert === 'email' && (
        <form className="pform mc-form" onSubmit={changeEmail}>
          <label className="pf">
            <span className="pl">Nouvelle adresse</span>
            <input type="email" value={nouvelEmail} required autoComplete="email"
              onChange={(e) => setNouvelEmail(e.target.value)} />
          </label>
          <label className="pf">
            <span className="pl">Mot de passe</span>
            <input type="password" value={mdpConfirme} required autoComplete="current-password"
              onChange={(e) => setMdpConfirme(e.target.value)} />
            <span className="pa">Demandé pour confirmer que c’est bien toi.</span>
          </label>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <div className="mc-actions">
            <button className="btn primaire" type="submit" disabled={envoi}>
              {envoi ? <><Spinner />Un instant…</> : 'Changer l’adresse'}
            </button>
            <button className="btn" type="button" onClick={ferme}>Annuler</button>
          </div>
        </form>
      )}
    </section>
  )
}
