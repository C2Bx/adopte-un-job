/* Entrée dans l'application. Un seul écran pour les deux gestes : demander
   « avez-vous un compte ? » avant de savoir ce qu'on vend est une question
   posée trop tôt.

   Les comptes ne sont pas à nous : c'est l'API de l'équipe qui les tient
   (`/auth/register`, `/auth/login`). D'où le prénom et le nom à l'inscription,
   qu'elle exige. Le parcours « mot de passe oublié » existe et est branché,
   mais il ne s'affiche que si elle l'expose : un lien qui mène à un message
   d'excuse vaut moins que pas de lien. */

import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { Utilisateur } from '../types'

export function Connexion({ onEntre }: { onEntre: (u: Utilisateur) => void | Promise<void> }) {
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  const [oubliPossible, setOubliPossible] = useState(false)
  const [codeRecu, setCodeRecu] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => { void api.capacites().then(setOubliPossible).catch(() => setOubliPossible(false)) }, [])

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErreur(null)
    setInfo(null)
    setEnvoi(true)
    try {
      if (mode === 'oubli') {
        if (codeRecu.trim()) {
          const r = await api.oubliConfirme(codeRecu.trim(), mdp)
          setInfo(r.message)
          setMode('connexion')
          setMdp('')
          setCodeRecu('')
        } else {
          setInfo((await api.oubli(email)).message)
        }
        return
      }
      const u = mode === 'connexion'
        ? await api.connexion(email, mdp)
        : await api.inscription(email, mdp, prenom.trim(), nom.trim())
      await onEntre(u)
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Quelque chose a échoué. Réessaie.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="accueil">
      <div className="accueil-in">
        <span className="mark grand">
          <img src={`${import.meta.env.BASE_URL}marque/logo-horizontal.png`}
            alt="Adopte un Job" className="logo" width={224} height={48} />
        </span>

        <h1>Un poste qui te correspond, pas trente CV envoyés.</h1>
        <p className="lead">
          Tu décris ce que tu cherches, ou tu déposes ton CV. Tu fais défiler les vrais postes ouverts
          à l’OPT-NC : <b>à droite pour candidater</b>, à gauche pour passer.
        </p>

        <div className="prole" role="tablist" aria-label="Type de compte">
          <button
            type="button"
            className={mode === 'connexion' ? 'on' : ''}
            onClick={() => { setMode('connexion'); setErreur(null); setInfo(null) }}
          >J’ai déjà un compte</button>
          <button
            type="button"
            className={mode === 'inscription' ? 'on' : ''}
            onClick={() => { setMode('inscription'); setErreur(null); setInfo(null) }}
          >Créer un compte</button>
        </div>

        <form className="pform" onSubmit={(e) => void soumets(e)}>
          {mode === 'inscription' && (
            <div className="pdeux">
              <label className="pf">
                <span className="pl">Prénom</span>
                <input type="text" value={prenom} required maxLength={40} autoComplete="given-name"
                  onChange={(e) => setPrenom(e.target.value)} />
              </label>
              <label className="pf">
                <span className="pl">Nom</span>
                <input type="text" value={nom} required maxLength={60} autoComplete="family-name"
                  onChange={(e) => setNom(e.target.value)} />
              </label>
            </div>
          )}

          <label className="pf">
            <span className="pl">Adresse e-mail</span>
            <input
              type="email" value={email} required autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          {mode === 'oubli' && (
            <label className="pf">
              <span className="pl">Code reçu (laisser vide pour en demander un)</span>
              <input type="text" value={codeRecu} autoComplete="one-time-code"
                onChange={(e) => setCodeRecu(e.target.value)} />
            </label>
          )}

          {(mode !== 'oubli' || codeRecu.trim() !== '') && <label className="pf">
            <span className="pl">{mode === 'oubli' ? 'Nouveau mot de passe' : 'Mot de passe'}</span>
            <input
              type="password" value={mdp} required minLength={mode === 'connexion' ? 1 : 12}
              autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'}
              onChange={(e) => setMdp(e.target.value)}
            />
            {mode === 'inscription' && (
              <span className="pa">
                Douze caractères au minimum, sans autre règle : une phrase se retient,
                une majuscule imposée finit sur un papier collé à l’écran.
              </span>
            )}
          </label>}

          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          {info && <div className="pal info"><b>Info</b>{info}</div>}

          <button className="btn primaire" type="submit" disabled={envoi}>
            {envoi ? <><Spinner />Un instant…</>
              : mode === 'connexion' ? 'Se connecter'
              : mode === 'inscription' ? 'Créer mon compte'
              : codeRecu.trim() ? 'Changer le mot de passe' : 'Recevoir un code'}
          </button>

          {/* Seulement si le service de comptes sait le faire. */}
          {mode === 'connexion' && oubliPossible && (
            <button type="button" className="btn-mini" style={{ alignSelf: 'center' }}
              onClick={() => { setMode('oubli'); setErreur(null); setInfo(null) }}>Mot de passe oublié</button>
          )}
          {mode === 'oubli' && (
            <button type="button" className="btn-mini" style={{ alignSelf: 'center' }}
              onClick={() => { setMode('connexion'); setErreur(null) }}>← Retour</button>
          )}
        </form>

        <p className="accueil-note">
          Projet d’étudiants du #HackAVP. Ton compte, ton profil et ton CV sont enregistrés
          dans l’API commune de l’équipe : les données sont réelles.
        </p>
      </div>
    </div>
  )
}
