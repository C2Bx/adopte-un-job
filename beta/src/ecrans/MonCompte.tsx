/* Mon compte : l'adresse et le mot de passe.

   Ils ne sont pas à nous. Depuis le 29/09 c'est le service de comptes de
   l'équipe qui les détient, et il n'expose pour l'instant que la création et
   la connexion. Les deux formulaires existent donc et sont déjà branchés,
   mais l'API dit (`comptesModifiables`) s'ils peuvent aboutir : tant que non,
   on montre la raison plutôt qu'un champ qui échouerait à l'envoi.

   Chaque geste redemande le mot de passe courant. Ce n'est pas de la
   paperasse : c'est lui qui sert à obtenir un jeton frais auprès d'eux, ce
   qui évite d'en conserver un entre deux requêtes. */

import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'

type Ouvert = 'aucun' | 'motdepasse' | 'email'

export function MonCompte() {
  const [email, setEmail] = useState('')
  const [modifiable, setModifiable] = useState<boolean | null>(null)
  const [ouvert, setOuvert] = useState<Ouvert>('aucun')

  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [nouvelEmail, setNouvelEmail] = useState('')
  const [mdpConfirme, setMdpConfirme] = useState('')

  const [envoi, setEnvoi] = useState(false)
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    void api.moi().then((u) => {
      setEmail(u?.email ?? '')
      setModifiable(u?.comptesModifiables ?? false)
    }).catch(() => setModifiable(false))
  }, [])

  const ferme = () => { setOuvert('aucun'); setErreur(null); setAncien(''); setNouveau(''); setNouvelEmail(''); setMdpConfirme('') }

  const changeMotDePasse = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null); setInfo(null); setEnvoi(true)
    try {
      await api.changeMotDePasse(ancien, nouveau)
      setInfo('Mot de passe changé. Tes autres sessions ont été fermées.')
      ferme()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : 'Le changement n’a pas abouti.')
    } finally { setEnvoi(false) }
  }

  const changeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setErreur(null); setInfo(null); setEnvoi(true)
    try {
      const r = await api.changeEmail(nouvelEmail.trim(), mdpConfirme)
      setEmail(r.email)
      setInfo('Adresse changée. C’est elle qu’il faudra saisir à la prochaine connexion.')
      ferme()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : 'Le changement n’a pas abouti.')
    } finally { setEnvoi(false) }
  }

  return (
    <section className="mcompte">
      <h3>Mon compte</h3>
      <dl className="mc-ligne">
        <dt>Adresse e-mail</dt>
        <dd>{email || <Spinner />}</dd>
      </dl>

      {modifiable === false && (
        <p className="pa">
          Changer ton mot de passe ou ton adresse n’est pas encore possible. Ça arrive.
        </p>
      )}

      {modifiable && ouvert === 'aucun' && (
        <div className="mc-actions">
          <button className="btn-mini" onClick={() => { ferme(); setOuvert('motdepasse') }}>Changer mon mot de passe</button>
          <button className="btn-mini" onClick={() => { ferme(); setOuvert('email') }}>Changer mon adresse</button>
        </div>
      )}

      {info && <div className="pal info"><b>C’est fait</b>{info}</div>}

      {modifiable && ouvert === 'motdepasse' && (
        <form className="pform mc-form" onSubmit={(e) => void changeMotDePasse(e)}>
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
        <form className="pform mc-form" onSubmit={(e) => void changeEmail(e)}>
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
