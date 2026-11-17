/* Le profil. Il s'enregistre tout seul, peu après la dernière frappe : un
   formulaire de cinq écrans qui perd tout sur un rafraîchissement ne se remplit
   jamais deux fois. */

import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { valideJsonResume } from '../jsonResume'
import { ApercuDocument } from './RelectureDocument'
import { ProfilEnrichi } from './ProfilEnrichi'
import {
  ETAPES, NIVEAUX, anneesExperience, completude, conseils, force, manques,
} from '../regles'
import { CarteCV, MesCV, ZoneCV, useMesCV } from './MesCV'
import { MonCompte } from './MonCompte'
import type { EtatSauvegarde } from '../sauvegarde'
import { Spinner } from '../Attente'
import { Puces, MetiersOptChoix } from './champs'
import { Questions } from './Questions'
import type { CompetenceOpt } from '../types'
import { ErreurApi } from '../types'
import type { Experience, Formation, Profil, Referentiels } from '../types'


/** Un profil qu'on n'a pas encore commence : on propose le chemin avant le
    formulaire, au lieu d'ouvrir cinq ecrans vides. */
function vierge(p: Profil): boolean {
  return p.metiersOpt.length === 0 && p.metiers.length === 0 && p.zones.length === 0
    && p.experiences.length === 0 && p.competences.length === 0
}

export function EcranProfil({ profil, onProfil, onModification, etat, avantOperation }: {
  profil: Profil; onProfil: (p: Profil) => void; onModification: (p: Profil) => void
  etat: EtatSauvegarde; avantOperation: () => Promise<void>
}) {
  const [etape, setEtape] = useState(0)
  // quand la lecture du CV a rempli le profil chez l'équipe, on le relit
  const cv = useMesCV(() => { void api.profil().then(onProfil).catch(() => undefined) }, avantOperation)
  const [mode, setMode] = useState<'choix' | 'form' | 'questions'>(() => (vierge(profil) ? 'choix' : 'form'))
  const [champVise, setChampVise] = useState<string | null>(null)
  const [conseilsOuverts, setConseilsOuverts] = useState(() => window.matchMedia('(min-width: 1100px)').matches)
  useEffect(() => {
    if (!champVise || mode !== 'form') return
    const trame = requestAnimationFrame(() => {
      const cible = document.querySelector<HTMLElement>(champVise)
      if (!cible) return
      const controle = cible.matches('input, select, textarea, button') ? cible : cible.querySelector<HTMLElement>('input, select, textarea, button')
      cible.scrollIntoView({ block: 'center', behavior: 'instant' })
      ;(controle ?? cible).focus({ preventScroll: true })
      cible.classList.add('profil-champ-vise')
      setChampVise(null)
    })
    return () => cancelAnimationFrame(trame)
  }, [champVise, mode, etape])
  const viseChamp = (etapeCible: number, champ: string) => {
    document.querySelectorAll('.profil-champ-vise').forEach((el) => el.classList.remove('profil-champ-vise'))
    setMode('form'); setEtape(etapeCible); setChampVise(champ)
  }

  const [ref, setRef] = useState<Referentiels | null>(null)
  // « Effacer mon CV » : efface le profil saisi chez eux (garde le fichier
  // déposé et la lecture n8n). Confirmation en deux temps, pas de popup.
  const [effConfirm, setEffConfirm] = useState(false)
  const [effEnCours, setEffEnCours] = useState(false)
  const [effErr, setEffErr] = useState<string | null>(null)
  const [expEnCours, setExpEnCours] = useState(false)
  const [impEnCours, setImpEnCours] = useState(false)
  const [importPret, setImportPret] = useState<{ doc: Record<string, unknown>; avant: Record<string, unknown>; nom: string } | null>(null)
  const [restauration, setRestauration] = useState(api.copieAvantImportDisponible())
  const [outilsMsg, setOutilsMsg] = useState<{ ok: boolean; texte: string } | null>(null)

  // Export du profil au format JSON Resume, réutilisable ailleurs.
  const exporteProfil = async () => {
    setOutilsMsg(null)
    setExpEnCours(true)
    try {
      await avantOperation()
      const doc = await api.exporteProfil()
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'mon-cv.jsonresume.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      setOutilsMsg({ ok: false, texte: e instanceof ErreurApi ? e.message : 'Le profil n’a pas pu être exporté.' })
    } finally {
      setExpEnCours(false)
    }
  }

  // Import d'un profil au format JSON Resume (remplace le CV, garde les critères).
  const importe = async (f: File) => {
    setOutilsMsg(null)
    setImpEnCours(true)
    try {
      if (f.size > 1024 * 1024) throw new Error('Le JSON Resume doit faire moins de 1 Mo.')
      await avantOperation()
      const texte = await f.text()
      let doc: unknown
      try { doc = JSON.parse(texte) } catch { throw new Error('Ce fichier n’est pas un JSON valide.') }
      const valide = valideJsonResume(doc)
      const avant = await api.exporteProfil()
      setImportPret({ doc: valide, avant, nom: f.name })
    } catch (e) {
      setOutilsMsg({ ok: false, texte: e instanceof ErreurApi ? e.message : e instanceof Error ? e.message : 'Ce JSON Resume n’a pas pu être importé.' })
    } finally {
      setImpEnCours(false)
    }
  }
  const appliqueImport = async (restaurer = false) => {
    if (!restaurer && !importPret) return
    setImpEnCours(true)
    setOutilsMsg(null)
    try {
      await avantOperation()
      const p = restaurer ? await api.restaureAvantImport() : await api.importeProfil(importPret!.doc)
      onProfil(p)
      setImportPret(null)
      setRestauration(api.copieAvantImportDisponible())
      setMode('form'); setEtape(0)
      setOutilsMsg({ ok: true, texte: restaurer ? 'Le profil avant import a été rétabli.' : 'Ton JSON Resume a été importé.' })
    } catch (e) {
      setOutilsMsg({ ok: false, texte: e instanceof Error ? e.message : 'L’opération a échoué.' })
    } finally { setImpEnCours(false) }
  }
  const effaceMonCv = async () => {
    setEffErr(null)
    setEffEnCours(true)
    try {
      await avantOperation()
      await api.supprimeMonCv()
      onProfil(await api.profil())
      setMode('choix')
      setEtape(0)
      setEffConfirm(false)
    } catch (e) {
      setEffErr(e instanceof ErreurApi ? e.message : 'Ton CV n’a pas pu être effacé.')
    } finally {
      setEffEnCours(false)
    }
  }

  useEffect(() => {
    void api.referentiels().then(setRef).catch(() => setRef(null))
  }, [])

  // Le deck demande d'aller corriger tel manque : il envoie l'étape.
  useEffect(() => {
    const va = (e: Event) => { setMode('form'); setEtape((e as CustomEvent<number>).detail) }
    document.addEventListener('aj:etape', va)
    return () => document.removeEventListener('aj:etape', va)
  }, [])

  const maj = (bout: Partial<Profil>) => onModification({ ...profil, ...bout })
  const aCombler = manques(profil)
  const surCetEcran = aCombler.filter((m) => m.etape === etape)
  const c = useMemo(() => conseils(profil), [profil])
  const vaEtape = (numero: number) => { setMode('form'); setEtape(numero); setChampVise('#profil-etape-titre') }
  const descriptions = ['Tes informations et tes disponibilités pour commencer.', 'Les métiers et contrats qui correspondent à ton projet.', 'Les expériences et formations qui illustrent ton parcours.', 'Tes savoir-faire, langues et compétences du référentiel.', 'Vérifie le dossier et complète les rubriques détaillées utiles.']

  return (
    <div className="screen" id="ec-profil">
      <div className="pad">
        <fieldset className="pcols profil-champs" disabled={impEnCours || effEnCours || cv.envoi || cv.lecture === 'en_cours' || cv.validation}>
          <header className="profil-intro">
            <div className="profil-titre"><div><span className="profil-surtitre">Ton dossier candidat</span><h1>Mon profil</h1><p>Complète et relis le dossier qui accompagne tes candidatures.</p></div>
              <span className={`psauve ${etat}`} role="status">{etat === 'envoi' ? <><Spinner />Enregistrement…</> : etat === 'ok' ? '✓ Enregistré' : etat === 'erreur' ? 'Non enregistré' : 'Profil chargé'}</span>
            </div>
            <div className="pentete profil-bilan">
              <div className="profil-progression"><div><strong>Informations requises</strong><span className="pc">{completude(profil)} %</span></div><div className="pbar" role="progressbar" aria-label="Informations requises renseignées" aria-valuenow={completude(profil)} aria-valuemin={0} aria-valuemax={100}><b style={{ width: `${completude(profil)}%` }} /></div><p>{aCombler.length ? `${aCombler.length} information${aCombler.length > 1 ? 's' : ''} à renseigner avant de candidater.` : 'L’essentiel est renseigné. Prends un instant pour relire le dossier.'}</p></div>
              <button type="button" className="btn primaire" onClick={() => aCombler[0] ? viseChamp(aCombler[0].etape, aCombler[0].champ) : vaEtape(4)}>{aCombler.length ? 'Compléter mon dossier' : 'Relire mon dossier'} <span aria-hidden="true">→</span></button>
            </div>
          </header>
          <div className="pcol-a">
            {mode !== 'choix' && <div className="profil-raccourcis">
              <details className="ui-cv"><summary><span className="profil-outil-numero" aria-hidden="true">CV</span><span>Mon CV : fichier et lecture<small>{!cv.pret ? 'Chargement du document…' : cv.erreur ? 'État du document à vérifier' : cv.actif ? cv.actif.nom : 'Déposer un fichier ou relire son extraction'}</small></span></summary><MesCV cv={cv} /></details>
              {mode === 'form' && <details className="ui-assistant"><summary><span className="profil-outil-numero" aria-hidden="true">?</span><span>Affiner par questions<small>Neuf étapes pour préciser tes préférences</small></span></summary><div className="qzrappel"><span>Réponds aux questions, puis vérifie les informations dans le formulaire.</span><button type="button" className="btn-mini" onClick={() => setMode('questions')}>Affiner par questions</button></div></details>}
            </div>}

            {/* Les trois façons de remplir son profil, côte à côte. */}
            {mode === 'choix' && (
              <div className="qzdepart trois">
                <CarteCV cv={cv} />
                <div className="qzcarte">
                  <h3>Je pars de zéro</h3>
                  <p>Le formulaire guidé, étape par étape. C’est le chemin principal, pas la solution de repli.</p>
                  <button type="button" className="btn-mini" onClick={() => setMode('form')}>Remplir à la main</button>
                </div>
                <div className="qzcarte fort">
                  <h3>Affiner par questions</h3>
                  <p>Neuf questions courtes, une par écran, pour cibler ce que le deck doit te proposer. C’est le chemin le plus rapide sur téléphone.</p>
                  <button type="button" className="btn-fort" onClick={() => setMode('questions')}>Répondre aux questions</button>
                </div>
              </div>
            )}
            {mode === 'choix' && <ZoneCV cv={cv} />}

            {mode === 'questions' && (
              <Questions
                profil={profil}
                maj={maj}
                ref_={ref}
                onFin={() => { setMode('form'); setEtape(4) }}
                onQuitter={() => setMode('form')}
              />
            )}

            {mode === 'form' && <section className="profil-edition" aria-labelledby="profil-etape-titre">
            <nav className="petapes" aria-label="Étapes du profil">
              {ETAPES.map((t, i) => {
                const n = aCombler.filter((m) => m.etape === i).length
                return (
                  <button
                    key={t}
                    type="button"
                    aria-current={i === etape ? 'step' : undefined}
                    className={`${i === etape ? 'on' : ''}${n === 0 && i < 4 ? ' fait' : ''}`}
                    onClick={() => vaEtape(i)}
                  >
                    <span className="n" aria-hidden="true">{n === 0 && i < 4 ? '✓' : i + 1}</span><span className="profil-etape-nom">{t}<small>{i === 4 ? 'Vérifier le dossier' : n ? `${n} à renseigner` : 'Renseigné'}</small></span>
                  </button>
                )
              })}
            </nav>
            <div className="profil-etape-entete"><span>Étape {etape + 1} sur {ETAPES.length}</span><h2 id="profil-etape-titre" tabIndex={-1}>{ETAPES[etape]}</h2><p>{descriptions[etape]}</p></div>
            <p className="profil-saisie-note">Les champs du formulaire s’enregistrent automatiquement. Les rubriques détaillées de la relecture ont leur propre bouton Enregistrer.</p>

            {surCetEcran.length > 0 && (
              <div className="pmanques">
                <b>
                  Il manque {surCetEcran.length === 1 ? 'une chose' : `${surCetEcran.length} choses`} sur cet écran
                </b>
                <ul>
                  {surCetEcran.map((m) => (
                    <li key={m.cle}>
                      <button type="button" onClick={() => viseChamp(m.etape, m.champ)}>
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
              {etape === 4 && <><Relecture p={profil} /><ProfilEnrichi avantOperation={avantOperation} onRelu={onProfil} /></>}
            </div>

            <div className="pnav">
              {etape > 0
                ? <button className="btn-mini" onClick={() => vaEtape(etape - 1)}>← Précédent</button>
                : <span />}
              {etape < ETAPES.length - 1 && (
                <button className="btn-fort" onClick={() => vaEtape(etape + 1)}>Suivant →</button>
              )}
            </div>
            </section>}
            <details className="ui-profil-outils"><summary>Mon compte, import et export</summary>
            <MonCompte />

            <div className="profil-donnees-titre"><h3>Une copie de ton dossier</h3><p>Exporte tes informations ou vérifie un fichier avant de l’importer.</p></div>
            <div className="poutils">
              <div className="poutils-btns">
                {!vierge(profil) && (
                  <button type="button" className="btn-mini" disabled={expEnCours}
                    onClick={() => void exporteProfil()}>
                    {expEnCours ? <><Spinner />…</> : 'Télécharger mon profil (JSON Resume)'}
                  </button>
                )}
                <label className="btn-mini poutils-fichier">
                  {impEnCours ? <><Spinner />…</> : 'Importer un JSON Resume'}
                  <input type="file" hidden accept=".json,application/json" disabled={impEnCours}
                    onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importe(f) }} />
                </label>
              </div>
              <span className="pa">Fichier JSON Resume : il contient les informations structurées du profil, pas le document PDF de ton CV.</span>
              {importPret && <div className="pal info" role="status">
                <b>Importer {importPret.nom} ?</b>
                Les rubriques du CV actuel seront remplacées. Tes critères de recherche seront gardés.
                Une copie du profil précédent sera récupérable dans cet onglet.
                <ApercuDocument document={importPret.doc} avant={importPret.avant} />
                <button type="button" className="btn-mini" onClick={() => void appliqueImport()}>Remplacer mon profil</button>
                <button type="button" className="btn-mini" onClick={() => setImportPret(null)}>Annuler</button>
              </div>}
              {restauration && <button type="button" className="btn-mini" onClick={() => void appliqueImport(true)}>
                Rétablir le profil avant import
              </button>}
              {outilsMsg && (
                <div className={`pal ${outilsMsg.ok ? 'ok' : 'manque'}`}>
                  <b>{outilsMsg.ok ? 'C’est fait' : 'Problème'}</b>{outilsMsg.texte}
                </div>
              )}
            </div>

            {!vierge(profil) && (
              <div className="peffacer">
                {!effConfirm ? (
                  <button type="button" className="btn-effacer"
                    onClick={() => { setEffErr(null); setEffConfirm(true) }}>Réinitialiser les informations du profil</button>
                ) : (
                  <div className="peffacer-boite">
                    <b>Effacer ce que tu as saisi dans ton profil ?</b>
                    <span>
                      Le fichier que tu as déposé et sa lecture automatique sont gardés —
                      tu pourras repartir d’eux.
                    </span>
                    {effErr && <div className="pal manque"><b>Problème</b>{effErr}</div>}
                    <div className="btns">
                      <button type="button" className="btn-mini" disabled={effEnCours}
                        onClick={() => setEffConfirm(false)}>Annuler</button>
                      <button type="button" className="btn-effacer fort" disabled={effEnCours}
                        onClick={() => void effaceMonCv()}>
                        {effEnCours ? <><Spinner />…</> : 'Oui, effacer'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            </details>
          </div>

          {<aside className="pcol-b">
            {c.length === 0
              ? <div className="pal ok"><b>Profil solide</b>Rien à améliorer côté structure.</div>
              : (
                <details className="pguide" open={conseilsOuverts} onToggle={(e) => setConseilsOuverts(e.currentTarget.open)}>
                  <summary>Améliorer mon profil <i>{c.length}</i></summary>
                  <div className="profil-redaction"><div><span>Richesse de rédaction</span><strong>{force(profil)} %</strong></div><p>Un repère pour présenter ton parcours. Il ne mesure pas l’adéquation à une offre.</p></div>
                  <ol className="pconseils">
                    {c.map((x) => <li key={x.quoi}><span><b>{x.quoi}</b>{x.pourquoi}</span><button type="button" className="btn-mini" onClick={() => viseChamp(x.etape, x.champ)} aria-label={`Corriger : ${x.quoi}`}>Corriger <span aria-hidden="true">→</span></button></li>)}
                  </ol>
                </details>
              )}
          </aside>}
        </fieldset>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------- morceaux -- */

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
          <span className="pa">Vérifie les informations d’identité de ton profil avant de candidater.</span>
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
          Indique les zones où tu souhaites travailler ; aucune adresse de résidence
          n’est demandée dans ce formulaire.
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
          ces choix décrivent ton projet professionnel pour le recruteur.
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
            Je privilégie mon métier
          </button>
          <button type="button" className={p.ouverture === 'ouvert' ? 'on' : ''} onClick={() => maj({ ouverture: 'ouvert' })}>
            Je suis ouvert aux métiers proches
          </button>
        </div>
        <span className="pa">
          Ces préférences accompagnent ton profil. Utilise les filtres du deck pour choisir
          les offres affichées ; l’adéquation compare les compétences de ton CV au poste.
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
            id="f-salaire" value={p.salaireMin ?? ''}
            onChange={(e) => maj({ salaireMin: e.target.value === '' ? null : Number(e.target.value) })}
          />
          <span className="pa">Cette attente est transmise avec ton profil. Elle ne filtre pas les offres et ne modifie pas l’adéquation.</span>
        </label>
        <label className="pf">
          <span className="pl">Permis B</span>
          <select id="f-permis"
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
            id="f-langues" onClick={() => maj({ langues: [...p.langues, { langue: '', niveau: 'B1' }] })}>+ Ajouter</button>
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
          <span className="pj-l">Richesse du profil</span>
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
        <b>Les informations demandées</b>
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
        Les AVP utilisent les compétences du référentiel OPT-NC. Choisis celles qui décrivent ton parcours ;
        vérifie aussi les codes déjà présents dans un profil importé.
      </p>
      <div className="pchips">
        {p.competencesOpt.length === 0
          ? <span className="pvide">Cherche une compétence du référentiel pour l’ajouter.</span>
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
