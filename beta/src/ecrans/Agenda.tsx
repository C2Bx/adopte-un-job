/* L'agenda des entretiens, pour tout le monde. Le candidat confirme un
   créneau parmi ceux proposés (les autres s'annulent) ou refuse ; l'organisation
   voit tous les entretiens de ses offres, quel que soit le collègue qui les a
   proposés — c'est le point de la vue par groupe. Chaque entretien s'exporte
   en .ics. Les heures viennent en UTC et s'affichent en heure locale. */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { ErreurApi } from '../types'
import type { Entretien, Role } from '../types'

const MODES: Record<string, string> = { 'sur place': 'Sur place', visio: 'Visio', telephone: 'Téléphone' }
const STATUTS: Record<Entretien['statut'], string> = {
  propose: 'proposé', confirme: 'confirmé', refuse: 'refusé', annule: 'annulé', termine: 'terminé',
}

export function dateLocale(utc: string): Date {
  return new Date(`${utc.replace(' ', 'T')}Z`)
}
export function formatJour(d: Date): string {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}
export function formatHeure(d: Date): string {
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function EcranAgenda({ role }: { role: Role }) {
  const [liste, setListe] = useState<Entretien[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [maintenant, setMaintenant] = useState<Date>(new Date())

  const charge = useCallback(async () => {
    try {
      const d = await api.agenda()
      setListe(d.entretiens)
      setMaintenant(dateLocale(d.maintenant))
    } catch (e) {
      setListe([])
      setErreur(e instanceof ErreurApi ? e.message : 'Agenda indisponible.')
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  const statut = async (e: Entretien, s: 'confirme' | 'refuse' | 'annule' | 'termine') => {
    try {
      await api.statutEntretien(e.id, s)
      await charge()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : 'Le changement n’a pas été enregistré.')
    }
  }

  /* Trois groupes : à confirmer (candidat) / en attente du candidat (organisation),
     à venir, passés. Un agenda se lit par ce qu'il attend de toi. */
  const groupes = useMemo(() => {
    const l = liste ?? []
    const aVenir = l.filter((e) => e.statut === 'confirme' && dateLocale(e.debut) >= maintenant)
    const proposes = l.filter((e) => e.statut === 'propose' && dateLocale(e.debut) >= maintenant)
    const passes = l.filter((e) => !aVenir.includes(e) && !proposes.includes(e))
    return { proposes, aVenir, passes }
  }, [liste, maintenant])

  const parJour = (l: Entretien[]) => {
    const m = new Map<string, Entretien[]>()
    for (const e of l) {
      const k = formatJour(dateLocale(e.debut))
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(e)
    }
    return [...m.entries()]
  }

  const Ligne = ({ e }: { e: Entretien }) => {
    const d = dateLocale(e.debut)
    const fin = new Date(d.getTime() + e.duree * 60000)
    return (
      <article className={`agenda-item ${e.statut}`}>
        <span className="heure"><b>{formatHeure(d)}</b><small>→ {formatHeure(fin)}</small></span>
        <div>
          <h3>{e.titre}</h3>
          <div className="meta">
            {role === 'candidat' ? e.organisation : (e.candidat ? `${e.candidat.prenom} ${e.candidat.nom}` : 'candidat')}
            {' · '}{MODES[e.mode] ?? e.mode}{e.lieu ? ` · ${e.lieu}` : ''}
            {' · '}<span className={`etat-ent ${e.statut}`}>{STATUTS[e.statut]}</span>
          </div>
          {e.notes && <p className="notes">{e.notes}</p>}
          {role !== 'candidat' && e.candidat?.telephone && e.statut === 'confirme' && (
            <div className="meta">{e.candidat.telephone}</div>
          )}
          <div className="actes">
            {role === 'candidat' && e.statut === 'propose' && (
              <>
                <button className="fort" onClick={() => void statut(e, 'confirme')}>Je confirme ce créneau</button>
                <button onClick={() => void statut(e, 'refuse')}>Ce créneau ne me va pas</button>
              </>
            )}
            {role !== 'candidat' && (e.statut === 'propose' || e.statut === 'confirme') && dateLocale(e.debut) >= maintenant && (
              <button onClick={() => void statut(e, 'annule')}>Annuler</button>
            )}
            {role !== 'candidat' && e.statut === 'confirme' && dateLocale(e.debut) < maintenant && (
              <button className="fort" onClick={() => void statut(e, 'termine')}>Marquer comme tenu</button>
            )}
            {(e.statut === 'confirme' || e.statut === 'propose') && (
              <a href={api.urlIcs(e.id)}>Ajouter à mon calendrier (.ics)</a>
            )}
          </div>
        </div>
      </article>
    )
  }

  const Groupe = ({ titre, l, vide }: { titre: string; l: Entretien[]; vide: string }) => (
    <section className="agenda-groupe">
      <h3 className="agenda-titre">{titre}<span className="n">{l.length}</span></h3>
      {l.length === 0
        ? <p className="pa">{vide}</p>
        : parJour(l).map(([jour, items]) => (
          <div key={jour}>
            <div className="agenda-jour">{jour}</div>
            {items.map((e) => <Ligne key={e.id} e={e} />)}
          </div>
        ))}
    </section>
  )

  return (
    <div className="screen" id="ec-agenda">
      <div className="pad">
        <h2>Agenda</h2>
        <p className="lead">
          {role === 'candidat'
            ? 'Les créneaux qu’on te propose, ceux que tu as confirmés, et le passé. Heures locales.'
            : 'Tous les entretiens de l’organisation, proposés par n’importe quel membre. Heures locales.'}
        </p>
        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}
        {liste === null && <p className="pa">Chargement…</p>}
        {liste !== null && (
          <>
            <Groupe titre={role === 'candidat' ? 'À confirmer' : 'En attente du candidat'} l={groupes.proposes}
              vide={role === 'candidat' ? 'Aucune proposition en attente.' : 'Aucun créneau en attente de réponse.'} />
            <Groupe titre="À venir" l={groupes.aVenir} vide="Rien de confirmé pour l’instant." />
            <Groupe titre="Passés ou annulés" l={groupes.passes} vide="Rien encore." />
          </>
        )}
      </div>
    </div>
  )
}

/* Le formulaire de proposition de créneaux, utilisé par l'organisation depuis
   une candidature. Un à six créneaux, une durée, un mode, un lieu. */
export function ProposerCreneaux({ candidature, onFait }: { candidature: number; onFait: () => void }) {
  const [creneaux, setCreneaux] = useState<string[]>([''])
  const [duree, setDuree] = useState(45)
  const [mode, setMode] = useState('sur place')
  const [lieu, setLieu] = useState('')
  const [notes, setNotes] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    const valides = creneaux.filter(Boolean)
    if (!valides.length) { setErreur('Indique au moins un créneau.'); return }
    setEnvoi(true)
    setErreur(null)
    try {
      // l'API attend l'UTC : on convertit l'heure locale saisie
      const utc = valides.map((v) => new Date(v).toISOString().slice(0, 16).replace('T', ' '))
      await api.proposeCreneaux(candidature, utc, duree, mode, lieu || undefined, notes || undefined)
      onFait()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Les créneaux n’ont pas été envoyés.')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <form className="pform" onSubmit={(e) => void soumets(e)}>
      <h3>Proposer un entretien</h3>
      <p className="pa">Le candidat choisit un créneau ; les autres s’annulent d’eux-mêmes.</p>
      {creneaux.map((c, i) => (
        <label className="pf" key={i}>
          <span className="pl">Créneau {i + 1}</span>
          <input type="datetime-local" value={c} required={i === 0}
            onChange={(e) => setCreneaux((l) => l.map((x, k) => (k === i ? e.target.value : x)))} />
        </label>
      ))}
      {creneaux.length < 6 && (
        <button type="button" className="btn-mini" onClick={() => setCreneaux((l) => [...l, ''])}>+ un autre créneau</button>
      )}
      <div className="pdeux">
        <label className="pf">
          <span className="pl">Durée</span>
          <select value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
            {[30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} min</option>)}
          </select>
        </label>
        <label className="pf">
          <span className="pl">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      </div>
      <label className="pf">
        <span className="pl">{mode === 'visio' ? 'Lien de visio' : mode === 'telephone' ? 'Qui appelle qui' : 'Lieu'}</span>
        <input type="text" value={lieu} onChange={(e) => setLieu(e.target.value)} maxLength={190} />
      </label>
      <label className="pf">
        <span className="pl">Note pour le candidat (facultatif)</span>
        <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="pièces à apporter, interlocuteurs…" />
      </label>
      {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
      <button className="btn primaire" type="submit" disabled={envoi}>{envoi ? 'Envoi…' : 'Proposer ces créneaux'}</button>
    </form>
  )
}
