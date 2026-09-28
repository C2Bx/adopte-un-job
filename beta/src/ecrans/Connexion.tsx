/* Entrée dans l'application. Un seul écran pour les deux gestes : demander
   « avez-vous un compte ? » avant de savoir ce qu'on vend est une question
   posée trop tôt. */

import { useState } from 'react'
import { api } from '../api'
import { ErreurApi } from '../types'
import type { Utilisateur } from '../types'

export function Connexion({ onEntre }: { onEntre: (u: Utilisateur) => void | Promise<void> }) {
  const [mode, setMode] = useState<'connexion' | 'inscription' | 'oubli'>('connexion')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  // mot de passe oublié : demande, puis code + nouveau mot de passe
  const [codeReinit, setCodeReinit] = useState('')
  const [info, setInfo] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErreur(null)
    setInfo(null)
    setEnvoi(true)
    try {
      if (mode === 'oubli') {
        if (codeReinit.trim()) {
          await api.reinitConfirme(codeReinit.trim(), mdp)
          setInfo('Mot de passe changé. Connecte-toi.')
          setMode('connexion')
          setMdp('')
        } else {
          const r = await api.reinit(email)
          setInfo(r.message + ' L’envoi d’e-mails n’est pas encore actif : le code est mis en file côté serveur.')
        }
        return
      }
      const u = mode === 'connexion'
        ? await api.connexion(email, mdp)
        : await api.inscription(email, mdp)
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
          Tu décris ce que tu cherches. On te propose les postes ouverts à l’OPT-NC qui collent, avec
          le pourcentage et surtout <b>pourquoi</b>. L’employeur ne voit ton nom qu’en te présélectionnant.
        </p>

        <div className="prole" role="tablist" aria-label="Type de compte">
          <button
            type="button"
            className={mode === 'connexion' ? 'on' : ''}
            onClick={() => setMode('connexion')}
          >J’ai déjà un compte</button>
          <button
            type="button"
            className={mode === 'inscription' ? 'on' : ''}
            onClick={() => setMode('inscription')}
          >Créer un compte</button>
        </div>

        <form className="pform" onSubmit={(e) => void soumets(e)}>
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
              <input type="text" value={codeReinit} onChange={(e) => setCodeReinit(e.target.value)} autoComplete="one-time-code" />
            </label>
          )}

          {(mode !== 'oubli' || codeReinit.trim()) && <label className="pf">
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
            {envoi ? 'Un instant…' : mode === 'connexion' ? 'Se connecter' : mode === 'inscription' ? 'Créer mon compte' : (codeReinit.trim() ? 'Changer le mot de passe' : 'Recevoir un code')}
          </button>
          {mode === 'connexion' && (
            <button type="button" className="btn-mini" style={{ alignSelf: 'center' }} onClick={() => { setMode('oubli'); setErreur(null) }}>Mot de passe oublié</button>
          )}
          {mode === 'oubli' && (
            <button type="button" className="btn-mini" style={{ alignSelf: 'center' }} onClick={() => setMode('connexion')}>← Retour</button>
          )}
        </form>

        <p className="accueil-note">
          Projet d’étudiants. Les données sont réelles et enregistrées :
          l’export et la suppression du compte sont disponibles dès maintenant.
        </p>
      </div>
    </div>
  )
}
