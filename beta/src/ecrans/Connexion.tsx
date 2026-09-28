/* Entrée dans l'application. Un seul écran pour les deux gestes : demander
   « avez-vous un compte ? » avant de savoir ce qu'on vend est une question
   posée trop tôt.

   Les comptes ne sont pas à nous : c'est l'API de l'équipe qui les tient
   (`/auth/register`, `/auth/login`). D'où le prénom et le nom à l'inscription,
   qu'elle exige — et l'absence de « mot de passe oublié », qu'elle n'expose
   pas encore. */

import { useState } from 'react'
import { api } from '../api'
import { Spinner } from '../Attente'
import { ErreurApi } from '../types'
import type { Utilisateur } from '../types'

export function Connexion({ onEntre }: { onEntre: (u: Utilisateur) => void | Promise<void> }) {
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setErreur(null)
    setEnvoi(true)
    try {
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
          Tu décris ce que tu cherches. On te propose les postes ouverts à l’OPT-NC qui collent, avec
          le pourcentage et surtout <b>pourquoi</b>. L’employeur ne voit ton nom qu’en te présélectionnant.
        </p>

        <div className="prole" role="tablist" aria-label="Type de compte">
          <button
            type="button"
            className={mode === 'connexion' ? 'on' : ''}
            onClick={() => { setMode('connexion'); setErreur(null) }}
          >J’ai déjà un compte</button>
          <button
            type="button"
            className={mode === 'inscription' ? 'on' : ''}
            onClick={() => { setMode('inscription'); setErreur(null) }}
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

          <label className="pf">
            <span className="pl">Mot de passe</span>
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
          </label>

          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}

          <button className="btn primaire" type="submit" disabled={envoi}>
            {envoi ? <><Spinner />Un instant…</> : mode === 'connexion' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>

        <p className="accueil-note">
          Projet d’étudiants. Ton compte est tenu par le service de comptes de l’équipe HackAVP :
          ton mot de passe y est vérifié, il n’est pas conservé ici. Les données sont réelles et
          enregistrées ; l’export et la suppression du compte sont disponibles dès maintenant.
        </p>
      </div>
    </div>
  )
}
