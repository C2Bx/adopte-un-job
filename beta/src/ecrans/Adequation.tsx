/* L'adéquation du profil avec une offre, calculée par CV-Matching (MS5,
   Jo-Michel), présentée comme un petit tableau de bord : une jauge (la part
   des compétences du poste couvertes), quatre indicateurs, puis la note de
   chaque compétence. Une indication pour le candidat, jamais un verdict ni un
   filtre : rien ne l'empêche de candidater.

   Deux sources : l'adéquation (POST /v1/match, déjà calculée pour toutes les
   offres) s'affiche tout de suite ; le détail (POST /v1/score, ~1 s) arrive
   ensuite. S'il manque, on retombe sur ce que /v1/match a déjà donné. */

import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Adequation, CompetenceNotee, DetailAdequation } from '../api'
import type { Offre } from '../types'

/** La pastille courte : sur la carte du deck, dans l'en-tête du détail, dans Candidatures. */
export function PastilleAdequation({ a, classe = 'cle' }: { a: Adequation; classe?: string }) {
  return (
    <span className={`${classe} adeq ${a.niveau}`}
      title={`${a.couverts} compétence${a.couverts > 1 ? 's' : ''} du poste sur ${a.total} retrouvée${a.couverts > 1 ? 's' : ''} dans ton profil (CV-Matching)`}>
      {a.libelle} · {a.pourcentage} %
    </span>
  )
}

/* Une liste coupée se déplie : « +26 » montre tout, « Réduire » referme. */
function useDepliable<T>(liste: T[], max: number) {
  const [ouvert, setOuvert] = useState(false)
  return {
    visibles: ouvert ? liste : liste.slice(0, max),
    reste: liste.length - max,
    ouvert,
    bascule: () => setOuvert((o) => !o),
  }
}

function BoutonDeplier({ reste, ouvert, bascule, quoi }: { reste: number; ouvert: boolean; bascule: () => void; quoi: string }) {
  if (reste <= 0) return null
  return (
    <button type="button" className="adq-deplier" aria-expanded={ouvert} onClick={bascule}
      aria-label={ouvert ? `Réduire la liste des ${quoi}` : `Voir les ${reste} autres ${quoi}`}>
      {ouvert ? 'Réduire' : `+${reste}`}
    </button>
  )
}

/* La jauge : un anneau, rempli à la part des compétences couvertes. Piste et
   remplissage dans la même teinte (celle du niveau), la piste plus claire. */
function Jauge({ a }: { a: Adequation }) {
  const r = 46
  const c = 2 * Math.PI * r
  const part = Math.max(0, Math.min(100, a.pourcentage)) / 100
  return (
    <div className="adq-jauge" role="img" aria-label={`${a.pourcentage} % des compétences du poste couvertes : ${a.libelle}`}>
      <svg viewBox="0 0 112 112" aria-hidden="true">
        <circle cx="56" cy="56" r={r} className="adq-piste" />
        {part > 0 && (
          <circle cx="56" cy="56" r={r} className="adq-arc" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 56 56)" />
        )}
      </svg>
      <div className="adq-jauge-c">
        <b>{a.pourcentage}<small>%</small></b>
        <span>des compétences</span>
      </div>
    </div>
  )
}

function Tuile({ titre, valeur, detail, part }: { titre: string; valeur: string; detail?: string; part?: number }) {
  return (
    <div className="adq-tuile">
      <span className="adq-t-titre">{titre}</span>
      <span className="adq-t-val">{valeur}{detail && <small> {detail}</small>}</span>
      {part !== undefined && (
        <span className="adq-t-piste" aria-hidden="true"><span style={{ width: `${Math.round(part * 100)}%` }} /></span>
      )}
    </div>
  )
}

const points = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/* Compétence par compétence : une barre par attendu du poste, sa note de
   couverture sur 100. Couvertes d'abord, puis celles à travailler, de la plus
   coûteuse à la moins coûteuse. Une seule échelle (0 à 100), le nom au-dessus,
   la valeur au bout ; le survol ou le focus montre la preuve. */
function Barres({ liste }: { liste: CompetenceNotee[] }) {
  const { visibles, reste, ouvert, bascule } = useDepliable(liste, 8)
  const [active, setActive] = useState<string | null>(null)
  return (
    <figure className="adq-barres">
      <figcaption>
        <b>Compétence par compétence</b>
        <span className="adq-legende">
          <span><i className="ok" />couverte</span>
          <span><i className="ko" />à travailler</span>
        </span>
      </figcaption>
      <ul>
        {visibles.map((c) => (
          <li key={c.attendu} className={c.couverte ? 'ok' : 'ko'} tabIndex={0}
            onMouseEnter={() => setActive(c.attendu)} onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(c.attendu)} onBlur={() => setActive(null)}
            aria-label={`${c.attendu} : ${c.note} sur 100, ${c.couverte ? 'couverte' : 'à travailler'}`}>
            <span className="adq-b-lib">{c.attendu}</span>
            <span className="adq-b-ligne">
              <span className="adq-b-piste"><span className="adq-b-val" style={{ width: `${Math.max(c.note, 1.5)}%` }} /></span>
              <span className="adq-b-n">{c.note}</span>
            </span>
            {active === c.attendu && (
              <span className="adq-bulle" role="tooltip">
                <b>{c.couverte ? `Couverte à ${c.note} / 100` : 'Pas retrouvée dans ton profil'}</b>
                {c.couverte && c.preuve && <span>Dans ton profil : « {c.preuve} »</span>}
                <span>{c.couverte ? `Rapporte ${points(c.poids)} points` : `Pèse ${points(c.poids)} points dans le score`}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <BoutonDeplier reste={reste} ouvert={ouvert} bascule={bascule} quoi="compétences" />
    </figure>
  )
}

function Etiquettes({ titre, liste, doux = false, quoi }: { titre: string; liste: string[]; doux?: boolean; quoi: string }) {
  const { visibles, reste, ouvert, bascule } = useDepliable(liste, 8)
  if (!liste.length) return null
  return (
    <div className="adq-bloc">
      <div className="do-sous">{titre}</div>
      <div className="tags">
        {visibles.map((e) => <span key={e} className={doux ? 'doux' : ''}>{e}</span>)}
        <BoutonDeplier reste={reste} ouvert={ouvert} bascule={bascule} quoi={quoi} />
      </div>
    </div>
  )
}

const STATUT_PREREQUIS: Record<string, string> = {
  rempli: 'rempli', non_rempli: 'pas encore', mention_probable: 'semble mentionné', a_verifier: 'à vérifier',
}

/** Le tableau de bord, dans le détail de l'offre. */
export function BlocAdequation({ offre: o, adequation: a }: { offre: Offre; adequation?: Adequation }) {
  const [detail, setDetail] = useState<DetailAdequation | null | undefined>(undefined)
  useEffect(() => {
    let vivant = true
    setDetail(undefined)
    if (a && o.reference) void api.detailAdequation(o.reference).then((d) => { if (vivant) setDetail(d) })
    return () => { vivant = false }
  }, [a, o.reference])
  if (!a) return null

  const prerequis = detail?.prerequis ?? []
  const aVerifier = prerequis.filter((x) => x.statut !== 'rempli').length
  const savoirEtre = detail?.savoirEtre.map((s) => s.attendu) ?? a.savoirEtre

  return (
    <section className={`adq adeq ${a.niveau}`} aria-label="Ton adéquation avec ce poste">
      <header className="adq-tete">
        <h3>Ton adéquation avec ce poste</h3>
        <span className="adq-niveau">{a.libelle}</span>
      </header>

      <div className="adq-haut">
        <Jauge a={a} />
        <div className="adq-tuiles">
          <Tuile titre="Compétences couvertes" valeur={`${a.couverts}`} detail={`/ ${a.total}`}
            part={a.total ? a.couverts / a.total : 0} />
          <Tuile titre="Rang parmi les offres" valeur={a.rang ? `${a.rang}${a.rang === 1 ? 're' : 'e'}` : '—'}
            detail={a.nbOffres ? `sur ${a.nbOffres}` : undefined} />
          <Tuile titre="Savoir-être à montrer" valeur={String(savoirEtre.length)} />
          <Tuile titre="Prérequis à vérifier" valeur={detail === undefined ? '…' : String(aVerifier)}
            detail={detail && prerequis.length ? `sur ${prerequis.length}` : undefined} />
        </div>
      </div>

      {!a.fiable && a.avertissement && <p className="adq-avert">{a.avertissement}</p>}

      {detail === undefined && <p className="adq-attente">Calcul du détail, compétence par compétence…</p>}
      {detail && detail.competences.length > 0 && <Barres liste={detail.competences} />}
      {/* sans le détail, on garde ce que le premier calcul a déjà donné */}
      {detail === null && (
        <>
          <Etiquettes titre="Ce que tu as déjà" liste={a.forces.map((f) => f.attendu)} quoi="compétences couvertes" />
          <Etiquettes titre="À mettre en avant, ou à acquérir" liste={a.ecarts} quoi="compétences à travailler" />
        </>
      )}

      <Etiquettes titre="Savoir-être, à montrer en entretien" liste={savoirEtre} doux quoi="savoir-être" />

      {prerequis.length > 0 && (
        <div className="adq-bloc">
          <div className="do-sous">Prérequis</div>
          <ul className="adq-prereq">
            {prerequis.map((x) => (
              <li key={x.prerequis}>
                <b>{x.prerequis}</b>
                <span className={`do-prereq ${x.statut}`}>{STATUT_PREREQUIS[x.statut] ?? x.statut}</span>
                {!x.obligatoire && <span className="doux">souhaité</span>}
                {x.motif && <span className="adq-motif">{x.motif}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="adq-source">
        Calculé par CV-Matching à partir du contenu de ton profil, sans ton nom ni tes coordonnées.
        C’est une indication, pas un verdict : rien ne t’empêche de candidater.
      </p>
    </section>
  )
}
