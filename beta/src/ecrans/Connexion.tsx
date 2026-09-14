/* Entrée dans l'application. Un seul écran pour les deux gestes : demander
   « avez-vous un compte ? » avant de savoir ce qu'on vend est une question
   posée trop tôt. */

import { useState } from 'react'
import { api } from '../api'
import { ErreurApi } from '../types'
import type { Utilisateur } from '../types'

export function Connexion({ onEntre }: { onEntre: (u: Utilisateur) => void | Promise<void> }) {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [role, setRole] = useState<'candidat' | 'recruteur'>('candidat')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
      const u = mode === 'connexion'
        ? await api.connexion(email, mdp)
        : await api.inscription(email, mdp, role)
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
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <rect x="4" y="7" width="16" height="21" rx="5" fill="var(--brand)" opacity=".28" transform="rotate(-8 12 17)" />
            <rect x="9" y="4" width="16" height="21" rx="5" fill="var(--brand)" />
            <circle cx="17" cy="14.5" r="3.2" fill="var(--accent)" />
          </svg>
          <b>Adopte un Job</b>
          <span className="tag-beta">bêta</span>
        </span>

        <h1>Un poste qui te correspond, pas trente CV envoyés.</h1>
        <p className="lead">
          Tu décris ce que tu cherches. On te propose ce qui colle, avec le pourcentage
          et surtout <b>pourquoi</b>. Une entreprise ne voit ton nom qu’après un match.
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
          {mode === 'inscription' && (
            <label className="pf">
              <span className="pl">Je suis</span>
              <div className="pseg">
                <button type="button" className={role === 'candidat' ? 'on' : ''} onClick={() => setRole('candidat')}>
                  à la recherche d’un poste
                </button>
                <button type="button" className={role === 'recruteur' ? 'on' : ''} onClick={() => setRole('recruteur')}>
                  une entreprise
                </button>
              </div>
            </label>
          )}

          <label className="pf">
            <span className="pl">Adresse e-mail</span>
            <input
              type="email" value={email} required autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="pf">
            <span className="pl">Mot de passe</span>
            <input
              type="password" value={mdp} required minLength={mode === 'inscription' ? 12 : 1}
              autoComplete={mode === 'inscription' ? 'new-password' : 'current-password'}
              onChange={(e) => setMdp(e.target.value)}
            />
            {mode === 'inscription' && (
              <span className="pa">
                Douze caractères au minimum, sans autre règle : une phrase se retient,
                une majuscule imposée finit sur un papier collé à l’écran.
              </span>
            )}
          </label>

          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}

          <button className="btn primaire" type="submit" disabled={envoi}>
            {envoi ? 'Un instant…' : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p className="accueil-note">
          Projet d’étudiants, en bêta. Les données sont réelles et enregistrées :
          l’export et la suppression du compte sont disponibles dès maintenant.
        </p>
      </div>
    </div>
  )
}
