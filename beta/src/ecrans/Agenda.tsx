/* L'agenda des entretiens, pour tout le monde. Le candidat confirme un
   créneau parmi ceux proposés (les autres s'annulent) ou refuse ; l'organisation
   voit tous les entretiens de ses offres, quel que soit le collègue qui les a
   proposés — c'est le point de la vue par groupe. Les heures viennent en UTC et
   s'affichent en heure locale.

   La mise en page suit ce qu'on vient chercher, dans l'ordre : le prochain
   rendez-vous et son compte à rebours, ce qui attend une réponse, puis la
   suite. Un agenda qui ouvre sur une liste plate oblige à chercher ces trois
   choses ; ici elles sont données. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
const finDe = (e: Entretien) => new Date(dateLocale(e.debut).getTime() + e.duree * 60000)
const cleJour = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/* « dans 3 jours » se lit d'un coup d'œil ; « 2026-10-02 09:00 » se déchiffre.
   En dessous de l'heure on descend à la minute : c'est le moment où ça compte. */
function delai(vers: Date, maintenant: Date): string {
  const s = Math.round((vers.getTime() - maintenant.getTime()) / 1000)
  if (s < 0) return 'maintenant'
  if (s < 60) return 'dans moins d’une minute'
  if (s < 3600) return `dans ${Math.round(s / 60)} min`
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    const m = Math.round((s - h * 3600) / 60)
    return m ? `dans ${h} h ${String(m).padStart(2, '0')}` : `dans ${h} h`
  }
  const j = Math.round(s / 86400)
  return j === 1 ? 'demain' : `dans ${j} jours`
}

/* Un lien de visio est cliquable, un numéro se compose, une adresse s'ouvre
   dans un plan. Le même champ « lieu » porte les trois selon le mode : c'est à
   l'écran d'en tirer le bon geste plutôt que d'afficher du texte inerte. */
function actionDuMode(e: Entretien): { href: string; libelle: string; externe: boolean } | null {
  const l = (e.lieu ?? '').trim()
  if (!l) return null
  if (e.mode === 'visio' && /^https?:\/\//i.test(l)) return { href: l, libelle: 'Rejoindre la visio', externe: true }
  if (e.mode === 'telephone') {
    const tel = l.replace(/[^\d+]/g, '')
    return tel.length >= 6 ? { href: `tel:${tel}`, libelle: 'Appeler', externe: false } : null
  }
  if (e.mode === 'sur place') {
    return { href: `https://www.openstreetmap.org/search?query=${encodeURIComponent(l)}`, libelle: 'Voir le plan', externe: true }
  }
  return null
}

function echappeIcs(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, '\\n')
}
const horodateIcs = (d: Date) => `${d.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`

/** Tous les entretiens retenus dans un seul fichier, construit ici : le serveur
    en produit un par entretien, et on ne va pas appeler dix fois pour dix. */
function icsGroupe(l: Entretien[], role: Role): string {
  const lignes = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adopte un Job//Agenda//FR', 'CALSCALE:GREGORIAN']
  for (const e of l) {
    const avec = role === 'candidat' ? e.organisation : (e.candidat ? `${e.candidat.prenom} ${e.candidat.nom}` : 'candidat')
    lignes.push(
      'BEGIN:VEVENT',
      `UID:entretien-${e.id}@adopte-un-job`,
      `DTSTAMP:${horodateIcs(new Date())}`,
      `DTSTART:${horodateIcs(dateLocale(e.debut))}`,
      `DTEND:${horodateIcs(finDe(e))}`,
      `SUMMARY:${echappeIcs(`Entretien — ${e.titre}`)}`,
      `DESCRIPTION:${echappeIcs([`Avec ${avec}`, MODES[e.mode] ?? e.mode, e.notes ?? ''].filter(Boolean).join('\n'))}`,
      ...(e.lieu ? [`LOCATION:${echappeIcs(e.lieu)}`] : []),
      'END:VEVENT',
    )
  }
  lignes.push('END:VCALENDAR')
  return lignes.join('\r\n')
}

type Vue = 'reponse' | 'avenir' | 'passe'

export function EcranAgenda({ role }: { role: Role }) {
  const [liste, setListe] = useState<Entretien[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [maintenant, setMaintenant] = useState<Date>(new Date())
  const [vue, setVue] = useState<Vue | null>(null)
  const [choix, setChoix] = useState<Record<number, number>>({})   // candidature -> entretien choisi
  const [occupe, setOccupe] = useState(false)
  const joursRef = useRef<Record<string, HTMLDivElement | null>>({})
  /* L'heure de référence vient du serveur : une horloge locale décalée ferait
     mentir tous les comptes à rebours. On lui ajoute le temps écoulé depuis. */
  const ancre = useRef<{ serveur: number; local: number } | null>(null)

  const charge = useCallback(async () => {
    try {
      const d = await api.agenda()
      setListe(d.entretiens)
      ancre.current = { serveur: dateLocale(d.maintenant).getTime(), local: Date.now() }
      setMaintenant(dateLocale(d.maintenant))
    } catch (e) {
      setListe([])
      setErreur(e instanceof ErreurApi ? e.message : 'Agenda indisponible.')
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  // Le compte à rebours doit vivre : figé, il vieillit sous les yeux.
  useEffect(() => {
    const t = window.setInterval(() => {
      const a = ancre.current
      setMaintenant(a ? new Date(a.serveur + (Date.now() - a.local)) : new Date())
    }, 20000)
    return () => window.clearInterval(t)
  }, [])

  const statut = async (e: Entretien, s: 'confirme' | 'refuse' | 'annule' | 'termine') => {
    setOccupe(true)
    try {
      await api.statutEntretien(e.id, s)
      await charge()
    } catch (x) {
      setErreur(x instanceof ErreurApi ? x.message : 'Le changement n’a pas été enregistré.')
    } finally {
      setOccupe(false)
    }
  }

  const groupes = useMemo(() => {
    const l = liste ?? []
    const futur = (e: Entretien) => finDe(e) >= maintenant
    const reponse = l.filter((e) => e.statut === 'propose' && futur(e))
    const avenir = l.filter((e) => e.statut === 'confirme' && futur(e))
      .sort((a, b) => dateLocale(a.debut).getTime() - dateLocale(b.debut).getTime())
    const passe = l.filter((e) => !reponse.includes(e) && !avenir.includes(e))
      .sort((a, b) => dateLocale(b.debut).getTime() - dateLocale(a.debut).getTime())
    return { reponse, avenir, passe }
  }, [liste, maintenant])

  /* Les propositions se regroupent par candidature : un créneau ne se juge pas
     seul, il se compare aux autres de la même offre. Confirmer l'un annule les
     autres — l'écran doit montrer ce choix, pas trois boutons identiques. */
  const propositions = useMemo(() => {
    const m = new Map<number, Entretien[]>()
    for (const e of groupes.reponse) {
      if (!m.has(e.candidature)) m.set(e.candidature, [])
      m.get(e.candidature)!.push(e)
    }
    for (const l of m.values()) l.sort((a, b) => dateLocale(a.debut).getTime() - dateLocale(b.debut).getTime())
    return [...m.values()]
  }, [groupes.reponse])

  // L'onglet d'ouverture est celui qui attend quelque chose de toi.
  useEffect(() => {
    if (vue !== null || liste === null) return
    setVue(groupes.reponse.length ? 'reponse' : (groupes.avenir.length ? 'avenir' : 'passe'))
  }, [liste, vue, groupes.reponse.length, groupes.avenir.length])

  const prochain = groupes.avenir[0] ?? null
  const courant = prochain && dateLocale(prochain.debut) <= maintenant

  /* Quinze jours de pastilles : l'aperçu d'un mois tiendrait dans la largeur
     mais montrerait surtout du vide — un agenda d'entretiens est clairsemé. */
  const jours = useMemo(() => {
    const debut = new Date(maintenant)
    debut.setHours(0, 0, 0, 0)
    return Array.from({ length: 15 }, (_, i) => {
      const d = new Date(debut.getTime() + i * 86400000)
      const k = cleJour(d)
      return {
        d, k,
        n: groupes.avenir.filter((e) => cleJour(dateLocale(e.debut)) === k).length,
        attente: groupes.reponse.some((e) => cleJour(dateLocale(e.debut)) === k),
      }
    })
  }, [maintenant, groupes.avenir, groupes.reponse])

  const versJour = (k: string) => {
    setVue('avenir')
    window.setTimeout(() => joursRef.current[k]?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60)
  }

  const telechargeTout = () => {
    const l = [...groupes.avenir, ...groupes.reponse]
    if (!l.length) return
    const url = URL.createObjectURL(new Blob([icsGroupe(l, role)], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'entretiens.ics'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const AvecQui = ({ e }: { e: Entretien }) =>
    <>{role === 'candidat' ? e.organisation : (e.candidat ? `${e.candidat.prenom} ${e.candidat.nom}` : 'candidat')}</>

  /* ------------------------------------------------------------- la carte */

  const Prochain = ({ e }: { e: Entretien }) => {
    const d = dateLocale(e.debut)
    const acte = actionDuMode(e)
    return (
      <article className={`ag-hero${courant ? ' encours' : ''}`}>
        <div className="ag-hero-date">
          <b>{d.toLocaleDateString('fr-FR', { day: 'numeric' })}</b>
          <span>{d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}</span>
        </div>
        <div className="ag-hero-corps">
          <span className="ag-quand">
            <i className="ag-pouls" aria-hidden="true" />
            {courant ? 'Entretien en cours' : delai(d, maintenant)}
          </span>
          <h3>{e.titre}</h3>
          <p className="ag-avec">
            avec <b><AvecQui e={e} /></b>
            {' · '}{formatHeure(d)} → {formatHeure(finDe(e))}
            {' · '}{MODES[e.mode] ?? e.mode}
          </p>
          {e.lieu && <p className="ag-lieu">{e.lieu}</p>}
          {e.notes && <p className="ag-notes">{e.notes}</p>}
          <div className="ag-actes">
            {acte && (
              <a className="btn-ag fort" href={acte.href}
                {...(acte.externe ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{acte.libelle}</a>
            )}
            <a className="btn-ag" href={api.urlIcs(e.id)}>Ajouter au calendrier</a>
            {role !== 'candidat' && e.candidat?.telephone && (
              <a className="btn-ag" href={`tel:${e.candidat.telephone.replace(/[^\d+]/g, '')}`}>{e.candidat.telephone}</a>
            )}
          </div>
        </div>
      </article>
    )
  }

  /* --------------------------------------------- une décision à prendre */

  const Proposition = ({ l }: { l: Entretien[] }) => {
    const e0 = l[0]!
    const selection = choix[e0.candidature] ?? l[0]!.id
    const selectionne = l.find((x) => x.id === selection) ?? e0
    return (
      <article className="ag-choix">
        <header>
          <h3>{e0.titre}</h3>
          <p className="ag-avec">avec <b><AvecQui e={e0} /></b> · {MODES[e0.mode] ?? e0.mode}{e0.lieu ? ` · ${e0.lieu}` : ''}</p>
        </header>
        {role === 'candidat' ? (
          <>
            <p className="ag-consigne">
              {l.length > 1
                ? `${l.length} créneaux proposés — choisis celui qui te va, les autres s’annulent.`
                : 'Un créneau proposé.'}
            </p>
            <div className="ag-creneaux" role="radiogroup" aria-label="Créneaux proposés">
              {l.map((e) => {
                const d = dateLocale(e.debut)
                return (
                  <button key={e.id} role="radio" aria-checked={e.id === selection}
                    className={`ag-creneau${e.id === selection ? ' on' : ''}`}
                    onClick={() => setChoix((c) => ({ ...c, [e0.candidature]: e.id }))}>
                    <span className="j">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="h">{formatHeure(d)} → {formatHeure(finDe(e))}</span>
                    <span className="r">{delai(d, maintenant)}</span>
                  </button>
                )
              })}
            </div>
            {e0.notes && <p className="ag-notes">{e0.notes}</p>}
            <div className="ag-actes">
              <button className="btn-ag fort" disabled={occupe} onClick={() => void statut(selectionne, 'confirme')}>
                Je confirme ce créneau
              </button>
              <button className="btn-ag" disabled={occupe} onClick={() => l.forEach((e) => void statut(e, 'refuse'))}>
                Aucun ne me convient
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ag-consigne">
              {l.length > 1 ? `${l.length} créneaux proposés, en attente de la réponse du candidat.` : 'Créneau proposé, en attente de réponse.'}
            </p>
            <div className="ag-creneaux">
              {l.map((e) => {
                const d = dateLocale(e.debut)
                return (
                  <span key={e.id} className="ag-creneau fige">
                    <span className="j">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="h">{formatHeure(d)} → {formatHeure(finDe(e))}</span>
                    <span className="r">{delai(d, maintenant)}</span>
                  </span>
                )
              })}
            </div>
            <div className="ag-actes">
              <button className="btn-ag" disabled={occupe} onClick={() => l.forEach((e) => void statut(e, 'annule'))}>
                Retirer ces créneaux
              </button>
            </div>
          </>
        )}
      </article>
    )
  }

  /* ---------------------------------------------------- la ligne de temps */

  const Ligne = ({ e }: { e: Entretien }) => {
    const d = dateLocale(e.debut)
    const acte = actionDuMode(e)
    const passe = finDe(e) < maintenant
    return (
      <article className={`ag-item ${e.statut}`}>
        <span className="ag-heure">
          <b>{formatHeure(d)}</b>
          <small>{formatHeure(finDe(e))}</small>
        </span>
        <div className="ag-corps">
          <h3>{e.titre}</h3>
          <p className="ag-avec">
            <AvecQui e={e} /> · {MODES[e.mode] ?? e.mode}
            {' · '}<span className={`ag-etat ${e.statut}`}>{STATUTS[e.statut]}</span>
          </p>
          {e.lieu && <p className="ag-lieu">{e.lieu}</p>}
          {e.notes && <p className="ag-notes">{e.notes}</p>}
          <div className="ag-actes">
            {e.statut === 'confirme' && !passe && acte && (
              <a className="btn-ag" href={acte.href}
                {...(acte.externe ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{acte.libelle}</a>
            )}
            {(e.statut === 'confirme' || e.statut === 'propose') && !passe && (
              <a className="btn-ag" href={api.urlIcs(e.id)}>Calendrier</a>
            )}
            {role !== 'candidat' && (e.statut === 'propose' || e.statut === 'confirme') && !passe && (
              <button className="btn-ag" disabled={occupe} onClick={() => void statut(e, 'annule')}>Annuler</button>
            )}
            {role !== 'candidat' && e.statut === 'confirme' && passe && (
              <button className="btn-ag fort" disabled={occupe} onClick={() => void statut(e, 'termine')}>Marquer comme tenu</button>
            )}
            {role === 'candidat' && e.statut === 'propose' && !passe && (
              <button className="btn-ag fort" disabled={occupe} onClick={() => void statut(e, 'confirme')}>Confirmer</button>
            )}
          </div>
        </div>
      </article>
    )
  }

  const Jours = ({ l }: { l: Entretien[] }) => {
    const m = new Map<string, { d: Date; items: Entretien[] }>()
    for (const e of l) {
      const d = dateLocale(e.debut)
      const k = cleJour(d)
      if (!m.has(k)) m.set(k, { d, items: [] })
      m.get(k)!.items.push(e)
    }
    return (
      <div className="ag-fil">
        {[...m.entries()].map(([k, { d, items }]) => (
          <div className="ag-bloc" key={k} ref={(n) => { joursRef.current[k] = n }}>
            <div className="ag-jour">
              <span>{formatJour(d)}</span>
              <i />
            </div>
            {items.map((e) => <Ligne key={e.id} e={e} />)}
          </div>
        ))}
      </div>
    )
  }

  const Vide = ({ titre, texte }: { titre: string; texte: string }) => (
    <div className="ag-vide">
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect x="8" y="14" width="48" height="42" rx="8" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M8 26h48" stroke="currentColor" strokeWidth="2.5" />
        <path d="M20 8v10M44 8v10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="41" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" opacity=".55" />
        <path d="M32 37v4.5l3 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
      </svg>
      <b>{titre}</b>
      <span>{texte}</span>
    </div>
  )

  const ONGLETS: { cle: Vue; nom: string; n: number }[] = [
    { cle: 'reponse', nom: role === 'candidat' ? 'À confirmer' : 'En attente', n: groupes.reponse.length },
    { cle: 'avenir', nom: 'À venir', n: groupes.avenir.length },
    { cle: 'passe', nom: 'Historique', n: groupes.passe.length },
  ]

  return (
    <div className="screen" id="ec-agenda">
      <div className="pad">
        <div className="ag-tete">
          <div>
            <h2>Agenda</h2>
            <p className="lead">
              {role === 'candidat'
                ? 'Les créneaux qu’on te propose, ceux que tu as confirmés, et le passé. Heures locales.'
                : 'Tous les entretiens de l’organisation, proposés par n’importe quel membre. Heures locales.'}
            </p>
          </div>
          {(groupes.avenir.length + groupes.reponse.length) > 1 && (
            <button className="btn-ag" onClick={telechargeTout}>Tout exporter (.ics)</button>
          )}
        </div>

        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}
        {liste === null && <p className="pa">Chargement…</p>}

        {liste !== null && (
          <>
            {prochain && <Prochain e={prochain} />}

            {(groupes.avenir.length > 0 || groupes.reponse.length > 0) && (
              <div className="ag-bande" role="list">
                {jours.map(({ d, k, n, attente }) => {
                  const aujourdhui = k === cleJour(maintenant)
                  return (
                    <button key={k} role="listitem"
                      className={`ag-pastille${n ? ' pleine' : ''}${attente ? ' attente' : ''}${aujourdhui ? ' auj' : ''}`}
                      disabled={!n && !attente}
                      onClick={() => versJour(k)}
                      aria-label={`${formatJour(d)}${n ? ` — ${n} entretien${n > 1 ? 's' : ''}` : ''}`}>
                      <span className="jj">{d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
                      <span className="nn">{d.getDate()}</span>
                      <i />
                    </button>
                  )
                })}
              </div>
            )}

            <div className="seg" role="tablist">
              {ONGLETS.map((o) => (
                <button key={o.cle} role="tab" aria-selected={vue === o.cle} onClick={() => setVue(o.cle)}>
                  {o.nom}<span className="n">{o.n}</span>
                </button>
              ))}
            </div>

            {vue === 'reponse' && (propositions.length
              ? <div className="ag-choix-liste">{propositions.map((l) => <Proposition key={l[0]!.id} l={l} />)}</div>
              : <Vide titre={role === 'candidat' ? 'Aucune proposition en attente' : 'Aucun créneau en attente'}
                  texte={role === 'candidat'
                    ? 'Quand une organisation te propose des créneaux, ils arrivent ici et tu choisis.'
                    : 'Proposez des créneaux depuis une candidature présélectionnée.'} />)}

            {vue === 'avenir' && (groupes.avenir.length
              ? <Jours l={groupes.avenir} />
              : <Vide titre="Rien de confirmé" texte="Les entretiens confirmés apparaissent ici, jour par jour." />)}

            {vue === 'passe' && (groupes.passe.length
              ? <Jours l={groupes.passe} />
              : <Vide titre="Pas encore d’historique" texte="Les entretiens passés, refusés et annulés restent consultables ici." />)}
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
