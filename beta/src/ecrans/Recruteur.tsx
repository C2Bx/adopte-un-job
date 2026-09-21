/* Le côté organisation : les offres (AVP synchronisés + offres internes), la
   file des candidatures classées par score, le traitement d'une candidature —
   présélection qui ouvre le contact et le dossier, entretien, refus — et
   l'organisation elle-même (membres, code d'invitation).

   Avant la présélection, le candidat est anonyme : ni nom, ni contact. Ce
   n'est pas de la pudeur, c'est ce qui empêche de trier sur autre chose que
   les compétences. */

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import { ErreurApi } from '../types'
import type { Candidature, CandidatVu, Evenement, Membre, Offre, Organisation, StatutCandidature, Utilisateur } from '../types'
import { Feuille } from './Deck'
import { ProposerCreneaux, dateLocale, formatHeure, formatJour } from './Agenda'

const NIV: Record<number, string> = { 1: 'Bac', 2: 'Bac+2', 3: 'Bac+3', 4: 'Bac+5' }
const teinte = (q: number) => (q >= 75 ? 'var(--yes)' : q >= 50 ? 'var(--accent)' : 'var(--no)')
const STATUTS: Record<StatutCandidature, string> = {
  envoyee: 'nouvelle', vue: 'vue', preselection: 'présélectionnée', entretien: 'entretien', acceptee: 'acceptée', refusee: 'refusée', retiree: 'retirée',
}
const OUVERTS: StatutCandidature[] = ['preselection', 'entretien', 'acceptee']

/* ------------------------------------------------------------ organisation */

export function EcranOrganisation({ moi, onChange }: { moi: Utilisateur; onChange: () => void }) {
  const [org, setOrg] = useState<Organisation | null | undefined>(undefined)
  const [membres, setMembres] = useState<Membre[]>([])
  const [code, setCode] = useState<string | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [nom, setNom] = useState('')
  const [codeSaisi, setCodeSaisi] = useState('')

  const charge = useCallback(async () => {
    try {
      const o = await api.organisation()
      setOrg(o)
      if (o) {
        const m = await api.membres()
        setMembres(m.membres)
        setCode(m.codeInvitation)
      }
    } catch (e) {
      setOrg(null)
      setErreur(e instanceof ErreurApi ? e.message : 'Organisation indisponible.')
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  const agit = async (f: () => Promise<unknown>) => {
    setErreur(null)
    try {
      await f()
      await charge()
      onChange()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Ça n’a pas marché.')
    }
  }

  if (org === undefined) return <div className="screen"><div className="pad"><p className="pa">Chargement…</p></div></div>

  if (!org) {
    return (
      <div className="screen" id="ec-organisation">
        <div className="pad">
          <h2>Ton organisation</h2>
          <p className="lead">
            Les offres, les candidatures et le tableau de bord appartiennent à une organisation, pas à un compte :
            plusieurs personnes des RH y travaillent ensemble. Crée-la, ou rejoins-la avec le code d’un collègue.
          </p>
          {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
          <div className="pcols">
            <form className="pform tile" onSubmit={(e) => { e.preventDefault(); void agit(() => api.creeOrganisation({ nom })) }}>
              <h3>Créer une organisation</h3>
              <label className="pf"><span className="pl">Nom</span><input type="text" required value={nom} onChange={(e) => setNom(e.target.value)} maxLength={160} /></label>
              <button className="btn primaire" type="submit">Créer</button>
            </form>
            <form className="pform tile" onSubmit={(e) => { e.preventDefault(); void agit(() => api.rejoins(codeSaisi)) }}>
              <h3>Rejoindre avec un code</h3>
              <label className="pf"><span className="pl">Code d’invitation</span><input type="text" required value={codeSaisi} onChange={(e) => setCodeSaisi(e.target.value.toUpperCase())} maxLength={14} placeholder="ABCD-EFGH-JKLM" /></label>
              <button className="btn primaire" type="submit">Rejoindre</button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const proprietaire = org.monRole === 'proprietaire' || moi.role === 'admin'
  return (
    <div className="screen" id="ec-organisation">
      <div className="pad">
        <h2>{org.nom}</h2>
        <p className="lead">
          {org.source === 'opt' ? 'Les AVP de cette organisation sont synchronisés depuis l’OPT-NC.' : 'Les offres sont saisies ici.'}{' '}
          Tous les membres voient les mêmes offres, candidatures, entretiens et chiffres.
        </p>
        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

        <div className="tile">
          <b>Inviter un collègue</b>
          <p className="pa" style={{ margin: 0 }}>Il crée un compte recruteur avec ce code, ou le saisit dans « Rejoindre ». Le code se remplace à tout moment ; l’ancien cesse aussitôt.</p>
          <div className="code-invitation">
            <code>{code ?? '—'}</code>
            <button type="button" className="btn-mini" onClick={() => { if (code) void navigator.clipboard?.writeText(code) }}>Copier</button>
            {proprietaire && <button type="button" className="btn-mini" onClick={() => void agit(() => api.nouveauCode())}>Nouveau code</button>}
          </div>
        </div>

        <div className="tile">
          <b>Membres</b>
          <ul className="membres">
            {membres.map((m) => (
              <li key={m.id}>
                <span><b>{m.email}</b><em>{m.role} · depuis {m.depuis.slice(0, 10)} · {m.decisions} décision{m.decisions > 1 ? 's' : ''}</em></span>
                <span className="mescv-btns">
                  {proprietaire && m.id !== moi.id && (
                    <select value={m.role} onChange={(e) => void agit(() => api.roleMembre(m.id, e.target.value as Membre['role']))} aria-label="Rôle">
                      <option value="proprietaire">propriétaire</option>
                      <option value="recruteur">recruteur</option>
                      <option value="lecteur">lecteur</option>
                    </select>
                  )}
                  {(proprietaire || m.id === moi.id) && (
                    <button type="button" className="btn-mini" onClick={() => { if (window.confirm(m.id === moi.id ? 'Quitter l’organisation ?' : `Retirer ${m.email} ?`)) void agit(() => api.retireMembre(m.id)) }}>
                      {m.id === moi.id ? 'Quitter' : 'Retirer'}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="pa">Un <b>lecteur</b> voit tout mais ne décide rien ; un <b>recruteur</b> traite les candidatures ; le <b>propriétaire</b> gère les membres.</p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ offres */

export function EcranOffres({ onCandidatures }: { onCandidatures: (offre: number) => void }) {
  const [offres, setOffres] = useState<Offre[] | null>(null)
  const [org, setOrg] = useState<Organisation | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [nouvelle, setNouvelle] = useState(false)

  const charge = useCallback(async () => {
    try {
      const d = await api.offres()
      setOffres(d.offres)
      setOrg(d.organisation)
    } catch (e) {
      setOffres([])
      setErreur(e instanceof ErreurApi ? e.message : 'Offres indisponibles.')
    }
  }, [])
  useEffect(() => { void charge() }, [charge])

  return (
    <div className="screen" id="ec-offres">
      <div className="pad">
        <div className="tb-tete">
          <div>
            <h2>Offres</h2>
            <p className="lead">
              {org?.source === 'opt'
                ? 'Les AVP ouverts et clos de l’OPT-NC, synchronisés depuis le dataset officiel. Une offre close reste consultable et garde ses candidatures.'
                : 'Les offres de l’organisation. Une offre close reste consultable et garde ses candidatures.'}
            </p>
          </div>
          {org && org.monRole !== 'lecteur' && <button className="btn primaire" onClick={() => setNouvelle(true)}>Publier une offre</button>}
        </div>
        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}
        {offres === null && <p className="pa">Chargement…</p>}
        {offres?.length === 0 && <div className="vide"><b>Aucune offre</b>Publie la première, ou attends la synchronisation des AVP.</div>}
        {(offres ?? []).map((o) => (
          <article className={`item${o.statut !== 'publiee' ? ' closed' : ''}`} key={o.id} onClick={() => onCandidatures(o.id)}>
            <span className="sc" style={{ color: o.enAttente ? 'var(--accent)' : 'var(--ink-3)' }}>
              {o.candidatures ?? 0}<small>CANDID.</small>
            </span>
            <div>
              <h3>{o.titre}</h3>
              <div className="meta">
                {o.ville ?? o.zone} · {o.contrat}{o.reference ? ` · réf. ${o.reference}` : ''}
                {o.statut !== 'publiee' ? ' · close' : o.joursRestants !== null ? ` · ${o.joursRestants} j restants` : ''}
              </div>
              <div className="quand">
                {o.vues ?? 0} vues · {o.enAttente ?? 0} à traiter · {o.matchs ?? 0} présélection{(o.matchs ?? 0) > 1 ? 's' : ''}
              </div>
            </div>
            <span className="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </article>
        ))}
      </div>
      {nouvelle && (
        <Feuille onFermer={() => setNouvelle(false)}>
          <FormulaireOffre onFait={() => { setNouvelle(false); void charge() }} />
        </Feuille>
      )}
    </div>
  )
}

function FormulaireOffre({ onFait }: { onFait: () => void }) {
  const [f, setF] = useState({ titre: '', codeMetier: '', contrat: 'CDI', zone: 'Grand Nouméa', ville: 'Nouméa', description: '', competences: '', expire: '', experienceMin: 0, teletravail: 'non' })
  const [metiers, setMetiers] = useState<{ code: string; nom: string; familleLibelle?: string | null }[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [envoi, setEnvoi] = useState(false)
  useEffect(() => { void api.metiers().then((d) => setMetiers(d.metiers)).catch(() => setMetiers([])) }, [])
  const maj = (k: keyof typeof f, v: string | number) => setF((x) => ({ ...x, [k]: v }))
  const soumets = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setEnvoi(true)
    setErreur(null)
    try {
      await api.creeOffre({
        titre: f.titre, codeMetier: f.codeMetier || undefined, contrat: f.contrat, zone: f.zone, ville: f.ville,
        description: f.description, experienceMin: f.experienceMin, teletravail: f.teletravail, statut: 'publiee',
        expire: f.expire || undefined, competencesTexte: f.competences.split('\n').map((x) => x.trim()).filter(Boolean),
      })
      onFait()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'L’offre n’a pas été publiée.')
    } finally {
      setEnvoi(false)
    }
  }
  return (
    <form className="pform" onSubmit={(e) => void soumets(e)}>
      <h2>Publier une offre</h2>
      <label className="pf"><span className="pl">Intitulé</span><input type="text" required value={f.titre} onChange={(e) => maj('titre', e.target.value)} maxLength={160} /></label>
      <label className="pf">
        <span className="pl">Métier du référentiel OPT-NC</span>
        <select value={f.codeMetier} onChange={(e) => maj('codeMetier', e.target.value)}>
          <option value="">— aucun —</option>
          {metiers.map((m) => <option key={m.code} value={m.code}>{m.nom}{m.familleLibelle ? ` (${m.familleLibelle})` : ''}</option>)}
        </select>
        <span className="pa">Il apporte ses compétences attendues, pondérées, au score.</span>
      </label>
      <div className="pdeux">
        <label className="pf"><span className="pl">Contrat</span>
          <select value={f.contrat} onChange={(e) => maj('contrat', e.target.value)}>{['CDI', 'CDD', 'Alternance', 'Intérim', 'Stage'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="pf"><span className="pl">Zone</span>
          <select value={f.zone} onChange={(e) => maj('zone', e.target.value)}>{['Grand Nouméa', 'Sud', 'Nord', 'Îles'].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <div className="pdeux">
        <label className="pf"><span className="pl">Ville</span><input type="text" value={f.ville} onChange={(e) => maj('ville', e.target.value)} maxLength={60} /></label>
        <label className="pf"><span className="pl">Clôture</span><input type="date" value={f.expire} onChange={(e) => maj('expire', e.target.value)} /></label>
      </div>
      <div className="pdeux">
        <label className="pf"><span className="pl">Expérience minimale (ans)</span><input type="number" min={0} max={15} value={f.experienceMin} onChange={(e) => maj('experienceMin', Number(e.target.value))} /></label>
        <label className="pf"><span className="pl">Télétravail</span>
          <select value={f.teletravail} onChange={(e) => maj('teletravail', e.target.value)}>{['non', 'hybride', 'total'].map((c) => <option key={c}>{c}</option>)}</select></label>
      </div>
      <label className="pf"><span className="pl">Description</span><textarea rows={4} value={f.description} onChange={(e) => maj('description', e.target.value)} maxLength={6000} /></label>
      <label className="pf"><span className="pl">Compétences attendues — une par ligne</span><textarea rows={4} value={f.competences} onChange={(e) => maj('competences', e.target.value)} placeholder={'Gérer une relation client\nTechniques de vente'} /></label>
      {erreur && <div className="pal manque"><b>Ça n’a pas marché</b>{erreur}</div>}
      <button className="btn primaire" type="submit" disabled={envoi}>{envoi ? 'Publication…' : 'Publier'}</button>
    </form>
  )
}

/* ------------------------------------------------------------ candidatures */

export function EcranCandidaturesRH({ offre, onRetour }: { offre?: number; onRetour?: () => void }) {
  const [liste, setListe] = useState<Candidature[] | null>(null)
  const [vivier, setVivier] = useState<CandidatVu[] | null>(null)
  const [titre, setTitre] = useState<string>('')
  const [filtre, setFiltre] = useState<'a_traiter' | 'ouvertes' | 'toutes'>('a_traiter')
  const [ouverte, setOuverte] = useState<number | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)

  const charge = useCallback(async () => {
    try {
      const l = await api.candidatures(offre ? { offre } : {})
      setListe(l)
      if (offre) {
        const d = await api.candidatsDe(offre, true)
        setTitre(d.offre.titre)
        setVivier(d.candidats.filter((c) => !c.candidature))
      }
    } catch (e) {
      setListe([])
      setErreur(e instanceof ErreurApi ? e.message : 'Candidatures indisponibles.')
    }
  }, [offre])
  useEffect(() => { void charge() }, [charge])

  const visibles = (liste ?? []).filter((c) =>
    filtre === 'toutes' ? true : filtre === 'ouvertes' ? OUVERTS.includes(c.statut) : ['envoyee', 'vue'].includes(c.statut))
    .sort((a, b) => (b.qualite ?? 0) - (a.qualite ?? 0))

  return (
    <div className="screen" id="ec-candidatures">
      <div className="pad">
        {onRetour && <button className="btn-mini" onClick={onRetour}>← Offres</button>}
        <h2>{offre ? titre || 'Candidatures' : 'Candidatures'}</h2>
        <p className="lead">
          Classées par compatibilité. Anonymes jusqu’à la présélection ; ensuite le contact s’ouvre et le dossier
          (CV recentré sur le poste + CV d’origine) est remis.
        </p>
        {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}
        <div className="seg" role="tablist">
          {([['a_traiter', 'À traiter'], ['ouvertes', 'Présélectionnées'], ['toutes', 'Toutes']] as const).map(([k, n]) => (
            <button key={k} role="tab" aria-selected={filtre === k} onClick={() => setFiltre(k)}>
              {n}<span className="n">{(liste ?? []).filter((c) => k === 'toutes' ? true : k === 'ouvertes' ? OUVERTS.includes(c.statut) : ['envoyee', 'vue'].includes(c.statut)).length}</span>
            </button>
          ))}
        </div>
        {liste === null && <p className="pa">Chargement…</p>}
        {liste !== null && visibles.length === 0 && <div className="vide"><b>Rien ici</b>Aucune candidature dans cet état.</div>}
        {visibles.map((c) => (
          <article className="item" key={c.id} onClick={() => setOuverte(c.id)}>
            <span className="sc" style={{ color: c.qualite === null ? 'var(--ink-3)' : teinte(c.qualite) }}>
              {c.qualite ?? '—'}<small>{c.qualite === null ? 'SANS SCORE' : 'SUR 100'}</small>
            </span>
            <div>
              <h3>{OUVERTS.includes(c.statut) && c.candidat?.prenom ? `${c.candidat.prenom} ${c.candidat.nom ?? ''}` : 'Candidat anonyme'}{!offre && ` — ${c.offre.titre}`}</h3>
              <div className="meta">
                {c.candidat?.metiersOpt.map((m) => m.nom).join(', ') || c.candidat?.metiers.join(', ') || 'métier non précisé'}
                {' · '}{c.candidat?.competences.length ?? 0} compétences{c.candidat?.formation ? ` · ${NIV[c.candidat.formation]}` : ''}
              </div>
              <div className="quand">Reçue le {c.creee.slice(0, 10)} · <b>{STATUTS[c.statut]}</b>{c.entretiens.length ? ` · ${c.entretiens.length} créneau${c.entretiens.length > 1 ? 'x' : ''}` : ''}</div>
            </div>
            <span className="chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </span>
          </article>
        ))}

        {offre && vivier && vivier.length > 0 && (
          <details className="tile" style={{ marginTop: 'var(--s5)' }}>
            <summary><b style={{ display: 'inline' }}>Le vivier</b> — {vivier.length} profil{vivier.length > 1 ? 's' : ''} sans candidature, classés pour ce poste</summary>
            <p className="pa">Des candidats inscrits qui n’ont pas (encore) candidaté. On ne les contacte pas : on sait qu’ils existent.</p>
            {vivier.slice(0, 20).map((v) => (
              <div className="item" key={v.id}>
                <span className="sc" style={{ color: teinte(v.score?.qualite ?? 0) }}>{v.score?.qualite ?? '—'}<small>SUR 100</small></span>
                <div>
                  <h3>Profil anonyme</h3>
                  <div className="meta">{v.metiersOpt.map((m) => m.nom).join(', ') || 'métier non précisé'} · {v.competences.length} compétences · {v.zones.join(', ')}</div>
                </div>
              </div>
            ))}
          </details>
        )}
      </div>

      {ouverte && (
        <Feuille onFermer={() => setOuverte(null)}>
          <FicheCandidature id={ouverte} onChange={() => void charge()} onFermer={() => setOuverte(null)} />
        </Feuille>
      )}
    </div>
  )
}

function FicheCandidature({ id, onChange, onFermer }: { id: number; onChange: () => void; onFermer: () => void }) {
  const [c, setC] = useState<Candidature | null>(null)
  const [ev, setEv] = useState<Evenement[]>([])
  const [erreur, setErreur] = useState<string | null>(null)
  const [creneaux, setCreneaux] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])

  const charge = useCallback(async () => {
    try {
      const d = await api.candidature(id)
      setC(d.candidature)
      setEv(d.evenements)
      if (OUVERTS.includes(d.candidature.statut)) {
        void api.suggestions(id).then((s) => setSuggestions(s.suggestions)).catch(() => undefined)
      }
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Candidature indisponible.')
    }
  }, [id])
  useEffect(() => { void charge() }, [charge])

  const statut = async (s: StatutCandidature) => {
    if (s === 'refusee' && !window.confirm('Refuser cette candidature ? Le candidat en sera informé.')) return
    setErreur(null)
    try {
      await api.statutCandidature(id, s)
      await charge()
      onChange()
    } catch (e) {
      setErreur(e instanceof ErreurApi ? e.message : 'Le changement n’a pas été enregistré.')
    }
  }

  if (!c) return <p className="pa">{erreur ?? 'Chargement…'}</p>
  const ouvert = OUVERTS.includes(c.statut)
  const v = c.candidat
  const st = c.score?.detail?.structurel ?? null
  const lex = c.score?.detail?.lexical ?? null

  return (
    <>
      <div className="eyebrow">Candidature · {STATUTS[c.statut]}</div>
      <h2>{ouvert && v?.prenom ? `${v.prenom} ${v.nom ?? ''}` : 'Candidat anonyme'}</h2>
      <div className="org">{c.offre.titre} · reçue le {c.creee.slice(0, 10)}</div>
      {erreur && <div className="pal manque"><b>Problème</b>{erreur}</div>}

      {c.qualite !== null && (
        <div className="score-ligne">
          <span className="v" style={{ color: teinte(c.qualite) }}>{c.qualite} %</span> compatible avec le poste
          {st && <> · référentiel {Math.round((st.v ?? 0) * 100)} %</>}
          {lex && <> · attentes de l’AVP {lex.ok.length}/{lex.total}</>}
        </div>
      )}

      {c.message && (<><h3>Message du candidat</h3><p className="qui">{c.message}</p></>)}

      {v && (
        <>
          <h3>Profil</h3>
          <dl className="kv2">
            <dt>Métiers visés</dt><dd>{v.metiersOpt.map((m) => m.nom).join(', ') || v.metiers.join(', ') || '—'}</dd>
            <dt>Formation</dt><dd>{v.formations.length ? v.formations.map((f) => `${NIV[f.niveau] ?? ''} ${f.domaine}`).join(' · ') : (v.formation ? NIV[v.formation] : '—')}</dd>
            <dt>Zones</dt><dd>{v.zones.join(', ') || '—'}</dd>
            <dt>Contrats</dt><dd>{v.contrats.join(', ') || '—'}</dd>
            <dt>Disponible</dt><dd>{v.dispo ?? '—'}</dd>
            {v.langues.length > 0 && <><dt>Langues</dt><dd>{v.langues.map((l) => `${l.langue} ${l.niveau}`).join(', ')}</dd></>}
            {ouvert && v.email && <><dt>E-mail</dt><dd><a href={`mailto:${v.email}`}>{v.email}</a></dd></>}
            {ouvert && v.telephone && <><dt>Téléphone</dt><dd>{v.telephone}</dd></>}
          </dl>
          {v.experiences.length > 0 && (
            <>
              <h3>Parcours</h3>
              <ul style={{ margin: 0, paddingLeft: 'var(--s5)', fontSize: 'var(--t-sm)' }}>
                {v.experiences.map((x, i) => <li key={i}><b>{x.poste}</b>{x.secteur ? ` — ${x.secteur}` : ''} ({x.debut}{x.fin && x.fin !== x.debut ? `–${x.fin}` : ''})</li>)}
              </ul>
            </>
          )}
          <h3>Compétences</h3>
          <div className="tags">
            {st?.ok.map((x) => <span key={x.code}>{x.nom}</span>)}
            {v.competences.map((x) => <span key={x} className="doux">{x}</span>)}
          </div>
          {st && st.manque.length > 0 && (
            <>
              <h3>Ce qui manque pour ce métier</h3>
              <div className="tags">{st.manque.slice(0, 8).map((x) => <span key={x.code} className="miss">{x.nom}</span>)}</div>
            </>
          )}
        </>
      )}

      <h3>Dossier</h3>
      {ouvert
        ? (
          <div className="btns">
            <a className="btn" href={api.urlCvCandidature(c.id)} target="_blank" rel="noreferrer">CV recentré sur le poste (PDF)</a>
            {c.dossier.cvOriginal
              ? <a className="btn" href={api.urlCvOriginal(c.id)} target="_blank" rel="noreferrer">CV d’origine du candidat</a>
              : <span className="pa">Le candidat n’a pas déposé de fichier.</span>}
          </div>
        )
        : <p className="pa">Le dossier — CV recentré et CV d’origine — s’ouvre avec la présélection, en même temps que le contact.</p>}

      {c.entretiens.length > 0 && (
        <>
          <h3>Entretiens</h3>
          <ul style={{ margin: 0, paddingLeft: 'var(--s5)', fontSize: 'var(--t-sm)' }}>
            {c.entretiens.map((e) => {
              const d = dateLocale(e.debut_utc)
              return <li key={e.id}>{formatJour(d)} à {formatHeure(d)} · {e.mode} · <b>{e.statut}</b></li>
            })}
          </ul>
        </>
      )}

      {suggestions.length > 0 && (
        <>
          <h3>Pour écrire au candidat</h3>
          <p className="pa">Des débuts de message, à adapter. La conversation est dans « Messages ».</p>
          <ul style={{ margin: 0, paddingLeft: 'var(--s5)', fontSize: 'var(--t-sm)', color: 'var(--ink-2)' }}>
            {suggestions.map((s) => <li key={s} style={{ marginBottom: 'var(--s2)' }}>{s}</li>)}
          </ul>
        </>
      )}

      <h3>Historique</h3>
      <ul className="evenements">
        {ev.map((e, i) => <li key={i}><time>{e.quand.slice(0, 16)}</time> {e.type.replace(/_/g, ' ')}{e.moi ? ' (moi)' : ''}</li>)}
      </ul>

      {creneaux && ouvert
        ? <ProposerCreneaux candidature={c.id} onFait={() => { setCreneaux(false); void charge(); onChange() }} />
        : (
          <div className="btns" style={{ marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
            {!ouvert && c.statut !== 'refusee' && c.statut !== 'retiree' && (
              <button className="btn primaire" onClick={() => void statut('preselection')}>Présélectionner — ouvrir le contact et le dossier</button>
            )}
            {ouvert && c.statut !== 'acceptee' && <button className="btn primaire" onClick={() => setCreneaux(true)}>Proposer un entretien</button>}
            {ouvert && c.statut !== 'acceptee' && <button className="btn" onClick={() => void statut('acceptee')}>Accepter</button>}
            {c.statut !== 'refusee' && c.statut !== 'retiree' && <button className="btn" onClick={() => void statut('refusee')}>Refuser</button>}
            <button className="btn" onClick={onFermer}>Fermer</button>
          </div>
        )}
    </>
  )
}
