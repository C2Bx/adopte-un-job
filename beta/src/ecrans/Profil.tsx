/* Le profil. Il s'enregistre tout seul, peu après la dernière frappe : un
   formulaire de cinq écrans qui perd tout sur un rafraîchissement ne se remplit
   jamais deux fois. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import {
  ETAPES, NIVEAUX, anneesExperience, completude, conseils, force, manques,
} from '../regles'
import { ImportCV } from './ImportCV'
import { MesCV } from './MesCV'
import { profilEnvoi } from '../regles'
import type { CompetenceOpt, MetierOpt } from '../types'
import { ErreurApi } from '../types'
import type { Experience, Formation, Profil, Referentiels } from '../types'

type Etat = 'repos' | 'envoi' | 'ok' | 'erreur'

export function EcranProfil({ profil, onProfil }: { profil: Profil; onProfil: (p: Profil) => void }) {
  const [etape, setEtape] = useState(0)
  const [ref, setRef] = useState<Referentiels | null>(null)
  const [etat, setEtat] = useState<Etat>('repos')
  const [relecture, setRelecture] = useState(false)
  const premier = useRef(true)
  // Le serveur rattache les compétences au référentiel et le renvoie : on
  // reprend sa version sans redéclencher un enregistrement.
  const depuisServeur = useRef(false)
  // Le profil tel qu'il est au dernier rendu : une réponse du serveur qui
  // arrive après une nouvelle saisie ne doit pas l'écraser.
  const courant = useRef(profil)
  courant.current = profil

  useEffect(() => {
    void api.referentiels().then(setRef).catch(() => setRef(null))
  }, [])

  // Le deck demande d'aller corriger tel manque : il envoie l'étape.
  useEffect(() => {
    const va = (e: Event) => setEtape((e as CustomEvent<number>).detail)
    document.addEventListener('aj:etape', va)
    return () => document.removeEventListener('aj:etape', va)
  }, [])

  // Enregistrement différé : on attend que la frappe s'arrête.
  useEffect(() => {
    if (premier.current) { premier.current = false; return }
    if (depuisServeur.current) { depuisServeur.current = false; return }
    setEtat('envoi')
    const envoye = profil
    const t = window.setTimeout(() => {
      void api.enregistreProfil(profilEnvoi(envoye))
        .then((p) => {
          setEtat('ok')
          // Si l'utilisateur a modifié entre-temps, on fusionne dans sa version
          // et on laisse l'enregistrement suivant repartir.
          depuisServeur.current = courant.current === envoye
          onProfil({ ...courant.current, competencesOpt: p.competencesOpt, metiersOpt: p.metiersOpt })
        })
        .catch(() => setEtat('erreur'))
    }, 800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil])

  const maj = (bout: Partial<Profil>) => onProfil({ ...profil, ...bout })
  const aCombler = manques(profil)
  const surCetEcran = aCombler.filter((m) => m.etape === etape)
  const c = useMemo(() => conseils(profil), [profil])

  return (
    <div className="screen" id="ec-profil">
      <div className="pad">
        <div className="pcols">
          <div className="pcol-a">
            <h2>Mon profil</h2>
            <p className="lead">
              Une fiche structurée, que tu vérifies et corriges. C’est elle qui décide de
              ce que le deck te propose.
            </p>

            <div className="pentete">
              <div className="pbar"><b style={{ width: `${completude(profil)}%` }} /></div>
              <span className="pc">{completude(profil)} % complété</span>
              <span className={`psauve ${etat}`}>
                {etat === 'envoi' ? 'enregistrement…' : etat === 'ok' ? 'enregistré' : etat === 'erreur' ? 'non enregistré' : ''}
              </span>
            </div>

            <ImportCV profil={profil} onProfil={onProfil} onRelecture={setRelecture} />
            {!relecture && <MesCV />}

            {!relecture && <>
            <div className="petapes">
              {ETAPES.map((t, i) => {
                const n = aCombler.filter((m) => m.etape === i).length
                return (
                  <button
                    key={t}
                    className={`${i === etape ? 'on' : ''}${i < etape ? ' fait' : ''}`}
                    onClick={() => setEtape(i)}
                  >
                    <span className="n">{i + 1}</span>{t}
                    {n > 0 && <i className="pm">{n}</i>}
                  </button>
                )
              })}
            </div>

            {surCetEcran.length > 0 && (
              <div className="pmanques">
                <b>
                  Il manque {surCetEcran.length === 1 ? 'une chose' : `${surCetEcran.length} choses`} sur cet écran
                </b>
                <ul>
                  {surCetEcran.map((m) => (
                    <li key={m.cle}>
                      <button type="button" onClick={() => document.querySelector<HTMLElement>(m.champ)?.focus()}>
                        {m.libelle}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pform">
              {etape === 0 && <QuiTuEs p={profil} maj={maj} ref_={ref} />}
              {etape === 1 && <CeQueTuCherches p={profil} maj={maj} ref_={ref} />}
              {etape === 2 && <Parcours p={profil} maj={maj} />}
              {etape === 3 && <Competences p={profil} maj={maj} ref_={ref} />}
              {etape === 4 && <Relecture p={profil} />}
            </div>

            <div className="pnav">
              {etape > 0
                ? <button className="btn-mini" onClick={() => setEtape(etape - 1)}>← Précédent</button>
                : <span />}
              {etape < ETAPES.length - 1 && (
                <button className="btn-fort" onClick={() => setEtape(etape + 1)}>Suivant →</button>
              )}
            </div>
            </>}
          </div>

          {!relecture && <aside className="pcol-b">
            {c.length === 0
              ? <div className="pal ok"><b>Profil solide</b>Rien à améliorer côté structure.</div>
              : (
                <details className="pguide" open>
                  <summary>Améliorer mon profil <i>{c.length}</i></summary>
                  <p className="pa">
                    La force du profil ne filtre rien : elle dit à quel point une entreprise
                    peut te lire. Force actuelle : {force(profil)} %.
                  </p>
                  <ol className="pconseils">
                    {c.map((x) => (
                      <li key={x.quoi}>
                        <b className={x.gain ? 'g' : 'g z'}>{x.gain ? `+${x.gain}` : 'deck'}</b>
                        <span><b>{x.quoi}</b>{x.pourquoi}</span>
                        <button type="button" className="btn-mini" onClick={() => setEtape(x.etape)}>Corriger</button>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
          </aside>}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- morceaux -- */

function Puces({ id, liste, valeurs, max, onChange }: {
  id: string
  liste: { slug?: string; label: string }[]
  valeurs: string[]
  max?: number
  onChange: (v: string[]) => void
}) {
  return (
    <div className="pchips" id={id} tabIndex={-1}>
      {liste.map((o) => {
        const cle = o.slug ?? o.label
        const on = valeurs.includes(cle)
        return (
          <button
            key={cle}
            type="button"
            className={`pchip${on ? ' on' : ''}`}
            onClick={() => {
              if (on) onChange(valeurs.filter((v) => v !== cle))
              else if (!max || valeurs.length < max) onChange([...valeurs, cle])
            }}
          >{o.label}</button>
        )
      })}
    </div>
  )
}

function QuiTuEs({ p, maj, ref_ }: { p: Profil; maj: (b: Partial<Profil>) => void; ref_: Referentiels | null }) {
  return (
    <>
      <div className="pgrid">
        <label className="pf">
          <span className="pl">Prénom</span>
          <input id="f-prenom" type="text" maxLength={30} value={p.prenom} onChange={(e) => maj({ prenom: e.target.value })} />
        </label>
        <label className="pf">
          <span className="pl">Initiale du nom</span>
          <input type="text" maxLength={2} value={p.initiale} onChange={(e) => maj({ initiale: e.target.value })} />
          <span className="pa">Ton nom complet ne sera visible qu’après un match.</span>
        </label>
      </div>

      <label className="pf">
        <span className="pl">Zones où tu acceptes de travailler</span>
        <Puces
          id="f-zones"
          liste={(ref_?.zones ?? []).map((z) => ({ label: z }))}
          valeurs={p.zones}
          onChange={(zones) => maj({ zones })}
        />
        <span className="pa">
          On ne te demande pas où tu habites : le lieu de résidence est un critère de
          discrimination, et il n’a aucune utilité pour le score.
        </span>
      </label>

      <div className="pgrid">
        <label className="pf">
          <span className="pl">Disponible à partir du</span>
          <input id="f-dispo" type="month" value={p.dispo ?? ''} onChange={(e) => maj({ dispo: e.target.value || null })} />
        </label>
        <label className="pf">
          <span className="pl">Télétravail souhaité</span>
          <select value={p.teletravail} onChange={(e) => maj({ teletravail: e.target.value as Profil['teletravail'] })}>
            {['peu importe', 'non', 'hybride', 'total'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
      </div>
    </>
  )
}

function CeQueTuCherches({ p, maj, ref_ }: { p: Profil; maj: (b: Partial<Profil>) => void; ref_: Referentiels | null }) {
  return (
    <>
      <label className="pf">
        <span className="pl">Métiers visés à l’OPT-NC — trois au maximum</span>
        <MetiersOptChoix id="f-metiers" liste={ref_?.metiersOpt ?? []} familles={ref_?.familles ?? []}
          valeurs={p.metiersOpt} onChange={(metiersOpt) => maj({ metiersOpt })} />
        <span className="pa">
          Les 84 métiers du référentiel de l’OPT-NC, par famille. Ce que tu <b>vises</b>, pas ce que tu as fait :
          le score compare chaque AVP à ton projet, métier par métier.
        </span>
      </label>
      <details className="pf">
        <summary className="pl">Autres métiers (hors OPT-NC)</summary>
        <Puces id="f-metiers-autres" liste={ref_?.metiers ?? []} valeurs={p.metiers} max={3} onChange={(metiers) => maj({ metiers })} />
      </details>

      <label className="pf">
        <span className="pl">Ouverture</span>
        <div className="pseg">
          <button type="button" className={p.ouverture === 'strict' ? 'on' : ''} onClick={() => maj({ ouverture: 'strict' })}>
            Mon métier uniquement
          </button>
          <button type="button" className={p.ouverture === 'ouvert' ? 'on' : ''} onClick={() => maj({ ouverture: 'ouvert' })}>
            Ouvert aux métiers proches
          </button>
        </div>
        <span className="pa">
          En mode ouvert, des offres accessibles depuis ton parcours entrent dans le deck,
          avec une pénalité et une étiquette.
        </span>
      </label>

      <label className="pf">
        <span className="pl">Contrats recherchés</span>
        <Puces
          id="f-contrats"
          liste={(ref_?.contrats ?? []).map((v) => ({ label: v }))}
          valeurs={p.contrats}
          onChange={(contrats) => maj({ contrats })}
        />
      </label>

      <div className="pgrid">
        <label className="pf">
          <span className="pl">Salaire mensuel minimum</span>
          <input
            type="number" step={10000} min={0} placeholder="non renseigné"
            value={p.salaireMin ?? ''}
            onChange={(e) => maj({ salaireMin: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <span className="pa">Laissé vide, ce critère est simplement ignoré — il ne te coûte aucun point.</span>
        </label>
        <label className="pf">
          <span className="pl">Permis B</span>
          <select
            value={String(p.permis)}
            onChange={(e) => maj({ permis: e.target.value === 'null' ? null : e.target.value === 'true' })}
          >
            <option value="null">non renseigné</option>
            <option value="true">oui</option>
            <option value="false">non</option>
          </select>
        </label>
      </div>
    </>
  )
}

function Parcours({ p, maj }: { p: Profil; maj: (b: Partial<Profil>) => void }) {
  const majExp = (i: number, bout: Partial<Experience>) =>
    maj({ experiences: p.experiences.map((x, k) => (k === i ? { ...x, ...bout } : x)) })
  const majFor = (i: number, bout: Partial<Formation>) =>
    maj({ formations: p.formations.map((x, k) => (k === i ? { ...x, ...bout } : x)) })

  return (
    <>
      <div className="prep">
        <div className="prep-t">
          <h3>Expériences</h3>
          <button
            id="f-exp" type="button" className="btn-mini"
            onClick={() => maj({ experiences: [...p.experiences, { poste: '', secteur: '', debut: '', fin: '' }] })}
          >+ Ajouter</button>
        </div>
        {p.experiences.length === 0 && <p className="pvide">Aucune expérience renseignée.</p>}
        {p.experiences.map((x, i) => (
          <div className="pbloc" key={i}>
            <div className="pgrid">
              <label className="pf"><span className="pl">Poste</span>
                <input type="text" value={x.poste} onChange={(e) => majExp(i, { poste: e.target.value })} /></label>
              <label className="pf"><span className="pl">Secteur</span>
                <input type="text" value={x.secteur} onChange={(e) => majExp(i, { secteur: e.target.value })} /></label>
              <label className="pf"><span className="pl">Début</span>
                <input type="text" maxLength={7} placeholder="2022 ou 2022-09" value={x.debut}
                  onChange={(e) => majExp(i, { debut: e.target.value })} /></label>
              <label className="pf"><span className="pl">Fin</span>
                <input type="text" maxLength={7} placeholder="en cours" value={x.fin}
                  onChange={(e) => majExp(i, { fin: e.target.value })} /></label>
            </div>
            <button type="button" className="btn-sup"
              onClick={() => maj({ experiences: p.experiences.filter((_, k) => k !== i) })}>Supprimer</button>
          </div>
        ))}
        <p className="pa">
          Une année seule suffit : on n’invente pas de mois. L’ancienneté déclarée est
          de {anneesExperience(p) ?? 0} an(s).
        </p>
      </div>

      <div className="prep">
        <div className="prep-t">
          <h3>Formations</h3>
          <button
            id="f-for" type="button" className="btn-mini"
            onClick={() => maj({ formations: [...p.formations, { niveau: 2, domaine: '' }] })}
          >+ Ajouter</button>
        </div>
        {p.formations.length === 0 && <p className="pvide">Aucune formation renseignée.</p>}
        {p.formations.map((f, i) => (
          <div className="pbloc" key={i}>
            <div className="pgrid">
              <label className="pf"><span className="pl">Niveau</span>
                <select value={f.niveau} onChange={(e) => majFor(i, { niveau: Number(e.target.value) })}>
                  {Object.entries(NIVEAUX).map(([n, nom]) => <option key={n} value={n}>{nom}</option>)}
                </select></label>
              <label className="pf"><span className="pl">Intitulé</span>
                <input type="text" value={f.domaine} onChange={(e) => majFor(i, { domaine: e.target.value })} /></label>
            </div>
            <button type="button" className="btn-sup"
              onClick={() => maj({ formations: p.formations.filter((_, k) => k !== i) })}>Supprimer</button>
          </div>
        ))}
        <p className="pa">
          Aucune date ici, volontairement : l’année d’obtention révèle l’âge, qui est un
          critère de discrimination interdit.
        </p>
      </div>
    </>
  )
}

function Competences({ p, maj, ref_ }: { p: Profil; maj: (b: Partial<Profil>) => void; ref_: Referentiels | null }) {
  const [saisie, setSaisie] = useState('')
  const ajoute = () => {
    const v = saisie.trim()
    if (v && !p.competences.includes(v)) maj({ competences: [...p.competences, v] })
    setSaisie('')
  }
  return (
    <>
      <div className="prep">
        <div className="prep-t"><h3>Compétences</h3></div>
        <div className="psaisie">
          <input
            id="f-comp" type="text" list="sugg" value={saisie}
            placeholder="ajouter une compétence puis Entrée"
            onChange={(e) => setSaisie(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ajoute() } }}
          />
          <datalist id="sugg">
            {(ref_?.competences ?? []).map((c) => <option key={c.slug} value={c.label} />)}
          </datalist>
          <button type="button" className="btn-mini" onClick={ajoute}>Ajouter</button>
        </div>
        <div className="pchips">
          {p.competences.length === 0
            ? <span className="pvide">Aucune compétence — c’est le critère le plus lourd du score.</span>
            : p.competences.map((c) => (
              <span className="pchip on lib" key={c}>
                {c}
                <button type="button" aria-label="Retirer"
                  onClick={() => maj({ competences: p.competences.filter((x) => x !== c) })}>✕</button>
              </span>
            ))}
        </div>
      </div>

      <CompetencesOptBloc p={p} maj={maj} />

      <div className="prep">
        <div className="prep-t">
          <h3>Langues</h3>
          <button type="button" className="btn-mini"
            onClick={() => maj({ langues: [...p.langues, { langue: '', niveau: 'B1' }] })}>+ Ajouter</button>
        </div>
        {p.langues.length === 0 && <p className="pvide">Aucune langue renseignée.</p>}
        {p.langues.map((l, i) => (
          <div className="pbloc" key={i}>
            <div className="pgrid">
              <label className="pf"><span className="pl">Langue</span>
                <input type="text" value={l.langue}
                  onChange={(e) => maj({ langues: p.langues.map((x, k) => (k === i ? { ...x, langue: e.target.value } : x)) })} /></label>
              <label className="pf"><span className="pl">Niveau</span>
                <select value={l.niveau}
                  onChange={(e) => maj({ langues: p.langues.map((x, k) => (k === i ? { ...x, niveau: e.target.value as typeof l.niveau } : x)) })}>
                  {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((n) => <option key={n}>{n}</option>)}
                </select></label>
            </div>
            <button type="button" className="btn-sup"
              onClick={() => maj({ langues: p.langues.filter((_, k) => k !== i) })}>Supprimer</button>
          </div>
        ))}
        <p className="pa">Niveaux au format européen : « B2 » se compare, « anglais courant » non.</p>
      </div>
    </>
  )
}

/* La fiche telle que l'entreprise la verra. Personne n'a besoin de lire du JSON
   pour savoir ce qu'on montre de lui. */
function Relecture({ p }: { p: Profil }) {
  const ans = anneesExperience(p)
  const niv = p.formations.length ? Math.max(...p.formations.map((f) => f.niveau)) : p.formation
  const fait = (icone: string, texte: string | null) =>
    texte ? <div className="fl"><span>{icone}</span>{texte}</div> : null

  return (
    <>
      <div className="pjauges">
        <div>
          <span className="pj-l">Complétude</span>
          <span className="pj-b"><b style={{ width: `${completude(p)}%` }} /></span>
          <span className="pj-v">{completude(p)} %</span>
        </div>
        <div>
          <span className="pj-l">Force du profil</span>
          <span className="pj-b"><b className="f" style={{ width: `${force(p)}%` }} /></span>
          <span className="pj-v">{force(p)} %</span>
        </div>
      </div>

      <div className="fiche-p">
        <div className="fp-tete">
          <span className="fp-pastille">{(p.prenom || '?').charAt(0).toUpperCase()}</span>
          <div>
            <b>{p.prenom || 'Prénom'}{p.initiale ? ` ${p.initiale.toUpperCase()}.` : ''}</b>
            <span>{p.metiersOpt.length ? p.metiersOpt.map((m) => m.nom).join(' · ') : (p.metiers.length ? p.metiers.join(' · ') : 'métier visé à renseigner')}</span>
          </div>
          {ans !== null && <span className="fp-ans">{ans}<small>AN{ans > 1 ? 'S' : ''}</small></span>}
        </div>

        <div className="fp-faits">
          {fait('◎', p.zones.join(' · '))}
          {fait('▤', p.contrats.join(' · '))}
          {fait('⬡', niv ? NIVEAUX[niv] ?? null : null)}
          {fait('◷', p.dispo ? `disponible dès ${p.dispo}` : null)}
          {fait('◇', p.salaireMin != null ? `à partir de ${Math.round(p.salaireMin / 1000)} k XPF` : null)}
          {fait('⬢', p.permis === true ? 'permis B' : p.permis === false ? 'sans permis' : null)}
        </div>

        {p.experiences.length > 0 && (
          <div className="fp-sec">
            <h4>Parcours</h4>
            {p.experiences.map((x, i) => (
              <div className="fp-exp" key={i}>
                <i>{x.debut}{x.fin && x.fin !== x.debut ? `–${x.fin}` : ''}</i>
                <span><b>{x.poste || 'poste non précisé'}</b>{x.secteur && <em>{x.secteur}</em>}</span>
              </div>
            ))}
          </div>
        )}

        {p.formations.length > 0 && (
          <div className="fp-sec">
            <h4>Formations</h4>
            {p.formations.map((f, i) => (
              <div className="fp-exp" key={i}>
                <i>{NIVEAUX[f.niveau] ?? '—'}</i>
                <span><b>{f.domaine || 'formation'}</b></span>
              </div>
            ))}
          </div>
        )}

        {p.competences.length > 0 && (
          <div className="fp-sec">
            <h4>Compétences</h4>
            <div className="fp-tags">{p.competences.map((c) => <span key={c}>{c}</span>)}</div>
          </div>
        )}
        {p.competencesOpt.length > 0 && (
          <div className="fp-sec">
            <h4>Dans le référentiel OPT-NC</h4>
            <div className="fp-tags">{p.competencesOpt.map((c) => <span key={c.code} title={c.depuis ? `lu dans : ${c.depuis}` : undefined}>{c.nom}</span>)}</div>
          </div>
        )}

        {p.langues.length > 0 && (
          <div className="fp-sec">
            <h4>Langues</h4>
            <div className="fp-tags">{p.langues.map((l) => <span key={l.langue}>{l.langue} {l.niveau}</span>)}</div>
          </div>
        )}
      </div>

      <div className="pmasque">
        <b>Ce qui n’est jamais collecté</b>
        Ta photo, ton lieu de résidence, ta date de naissance et l’année de tes diplômes.
        Aucun de ces éléments n’entre dans le score, et chacun est un vecteur de
        discrimination connu.
      </div>
    </>
  )
}

/* Le choix d'un métier OPT : une liste déroulante par famille, des puces
   pour ce qui est retenu. Quatre-vingt-quatre puces à l'écran ne se lisent
   pas ; une liste groupée, si. */
function MetiersOptChoix({ id, liste, familles, valeurs, onChange }: {
  id: string
  liste: MetierOpt[]
  familles: { id: string; libelle: string }[]
  valeurs: MetierOpt[]
  onChange: (v: MetierOpt[]) => void
}) {
  const [choix, setChoix] = useState('')
  const parFamille = useMemo(() => {
    const m = new Map<string, MetierOpt[]>()
    for (const x of liste) {
      const k = x.familleLibelle ?? x.famille ?? 'Autres'
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(x)
    }
    return [...m.entries()]
  }, [liste])
  return (
    <div id={id} tabIndex={-1}>
      <div className="pchips">
        {valeurs.map((m) => (
          <span className="pchip on lib" key={m.code}>
            {m.nom}
            <button type="button" aria-label="Retirer" onClick={() => onChange(valeurs.filter((x) => x.code !== m.code))}>✕</button>
          </span>
        ))}
        {valeurs.length === 0 && <span className="pvide">Aucun métier visé — sans lui, le score ne sait pas où tu veux aller.</span>}
      </div>
      {valeurs.length < 3 && (
        <select
          value={choix}
          onChange={(e) => {
            const m = liste.find((x) => x.code === e.target.value)
            if (m && !valeurs.some((v) => v.code === m.code)) onChange([...valeurs, m])
            setChoix('')
          }}
          aria-label="Ajouter un métier"
        >
          <option value="">Ajouter un métier…</option>
          {parFamille.map(([f, ms]) => (
            <optgroup label={f} key={f}>
              {ms.map((m) => <option key={m.code} value={m.code}>{m.nom}{m.avpOuverts ? ` (${m.avpOuverts} AVP)` : ''}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {familles.length > 0 && valeurs.length > 0 && (
        <span className="pa">Famille{valeurs.length > 1 ? 's' : ''} : {[...new Set(valeurs.map((v) => v.familleLibelle ?? v.famille))].join(', ')}</span>
      )}
    </div>
  )
}

/* Les compétences telles que l'OPT les nomme. Ce qui est rattaché l'a été par
   les mots : on le montre, avec la source, et on laisse ajouter ou retirer. */
function CompetencesOptBloc({ p, maj }: { p: Profil; maj: (b: Partial<Profil>) => void }) {
  const [q, setQ] = useState('')
  const [trouve, setTrouve] = useState<{ code: string; nom: string }[]>([])
  useEffect(() => {
    if (q.trim().length < 3) { setTrouve([]); return }
    const t = window.setTimeout(() => {
      void api.competencesOpt(q.trim()).then((d) => setTrouve(d.competences)).catch(() => setTrouve([]))
    }, 300)
    return () => window.clearTimeout(t)
  }, [q])
  const ajoute = (c: { code: string; nom: string }) => {
    if (p.competencesOpt.some((x) => x.code === c.code)) return
    maj({ competencesOpt: [...p.competencesOpt, { code: c.code, nom: c.nom, source: 'saisie' }] })
    setQ('')
  }
  const retire = (c: CompetenceOpt) => maj({ competencesOpt: p.competencesOpt.filter((x) => x.code !== c.code) })
  return (
    <div className="prep">
      <div className="prep-t"><h3>Dans les mots de l’OPT-NC</h3></div>
      <p className="pa" style={{ marginTop: 0 }}>
        Les AVP sont écrits avec les 409 compétences du référentiel. Tes compétences y sont rattachées
        automatiquement par leurs mots — vérifie, retire ce qui est faux, ajoute ce qui manque.
      </p>
      <div className="pchips">
        {p.competencesOpt.length === 0
          ? <span className="pvide">Rien de rattaché pour l’instant : enregistre d’abord tes compétences.</span>
          : p.competencesOpt.map((c) => (
            <span className={`pchip on${c.source === 'saisie' ? '' : ' lib'}`} key={c.code}
              title={c.depuis ? `rattachée depuis « ${c.depuis} »` : 'ajoutée par toi'}>
              {c.nom}
              <button type="button" aria-label="Retirer" onClick={() => retire(c)}>✕</button>
            </span>
          ))}
      </div>
      <div className="psaisie">
        <input type="text" value={q} placeholder="chercher dans le référentiel (3 lettres)"
          onChange={(e) => setQ(e.target.value)} aria-label="Chercher une compétence OPT" />
      </div>
      {trouve.length > 0 && (
        <div className="pchips">
          {trouve.filter((c) => !p.competencesOpt.some((x) => x.code === c.code)).slice(0, 12).map((c) => (
            <button type="button" className="pchip" key={c.code} onClick={() => ajoute(c)}>+ {c.nom}</button>
          ))}
        </div>
      )}
    </div>
  )
}

/* Rendu inutilisé mais conservé : le typage garantit que l'erreur d'API reste
   traitée là où elle apparaît. */
export function messageErreur(e: unknown): string {
  return e instanceof ErreurApi ? e.message : 'Une erreur inattendue est survenue.'
}
