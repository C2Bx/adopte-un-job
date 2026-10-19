/* Le questionnaire guidé — neuf questions, une par écran.
   Sur téléphone, un formulaire long est abandonné, une suite de questions
   courtes est terminée. C'est le même profil qui est rempli : pas un second
   modèle, pas une seconde vérité.

   Les réponses s'appliquent AU FUR ET À MESURE, et non à la fin : l'écran de
   profil enregistre tout seul, donc quitter au milieu garde ce qui a déjà été
   répondu. Un questionnaire qui perd tout quand on le ferme ne se reprend
   jamais. */

import type { ReactNode } from 'react'
import { useState } from 'react'
import { Puces, MetiersOptChoix } from './champs'
import type { Profil, Referentiels } from '../types'

/** Le mois AAAA-MM dans n mois, format attendu par `candidates.dispo`. */
function moisDans(n: number): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Les contraintes qu'on peut exclure. Mêmes clés que la colonne SET `refus`. */
const REFUS: { slug: string; label: string }[] = [
  { slug: 'nuit', label: 'Le travail de nuit' },
  { slug: 'weekend', label: 'Le travail le week-end' },
  { slug: 'deplacements', label: 'Les déplacements fréquents' },
  { slug: 'coupures', label: 'Les horaires coupés' },
  { slug: 'astreinte', label: 'Les astreintes' },
]

type Maj = (bout: Partial<Profil>) => void

interface Question {
  cle: string
  titre: string
  aide?: string
  champ: (p: Profil, maj: Maj, ref_: Referentiels | null) => ReactNode
  /** Y a-t-il une réponse ? Change le libellé du bouton, ne bloque jamais. */
  repondu: (p: Profil) => boolean
}

/** Une liste de gros choix, un par ligne : la cible tactile fait toute la ligne. */
function Choix<T>({ valeur, options, onChange }: {
  valeur: T
  options: { v: T; label: string; aide?: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="qzchoix">
      {options.map((o, i) => (
        <button
          key={i}
          type="button"
          className={`qzopt${Object.is(o.v, valeur) ? ' on' : ''}`}
          aria-pressed={Object.is(o.v, valeur)}
          onClick={() => onChange(o.v)}
        >
          <span className="qzopt-l">{o.label}</span>
          {o.aide && <span className="qzopt-a">{o.aide}</span>}
        </button>
      ))}
    </div>
  )
}

const QUESTIONS: Question[] = [
  {
    cle: 'ouverture',
    titre: 'Qu’est-ce que tu cherches ?',
    aide: 'Ça décide de ce qui entre dans ton deck. Tu pourras le changer à tout moment.',
    repondu: () => true,
    champ: (p, maj) => (
      <Choix
        valeur={p.ouverture}
        onChange={(ouverture) => maj({ ouverture })}
        options={[
          { v: 'strict' as const, label: 'Un poste dans mon métier', aide: 'Uniquement les AVP du ou des métiers que je vise.' },
          { v: 'ouvert' as const, label: 'Mon métier, ou juste à côté', aide: 'Les métiers proches entrent aussi, avec une étiquette et une pénalité.' },
        ]}
      />
    ),
  },
  {
    cle: 'metiers',
    titre: 'Quels métiers vises-tu ?',
    aide: 'Trois au maximum, dans les mots de l’OPT-NC. C’est ton projet qui compte, pas ton passé : le score compare l’AVP à ce que tu vises.',
    repondu: (p) => p.metiersOpt.length > 0,
    champ: (p, maj, ref_) => (
      <MetiersOptChoix
        id="qz-metiers"
        liste={ref_?.metiersOpt ?? []}
        familles={ref_?.familles ?? []}
        valeurs={p.metiersOpt}
        onChange={(metiersOpt) => maj({ metiersOpt })}
      />
    ),
  },
  {
    cle: 'zones',
    titre: 'Où acceptes-tu de travailler ?',
    aide: 'On ne te demande pas où tu habites : le lieu de résidence est un motif de discrimination et n’apporte rien au score.',
    repondu: (p) => p.zones.length > 0,
    champ: (p, maj, ref_) => (
      <Puces id="qz-zones" liste={(ref_?.zones ?? []).map((v) => ({ label: v }))} valeurs={p.zones} onChange={(zones) => maj({ zones })} />
    ),
  },
  {
    cle: 'contrats',
    titre: 'Quels types de contrat ?',
    aide: 'Rien de coché veut dire « tous » : aucun AVP ne sera écarté pour son contrat.',
    repondu: (p) => p.contrats.length > 0,
    champ: (p, maj, ref_) => (
      <Puces id="qz-contrats" liste={(ref_?.contrats ?? []).map((v) => ({ label: v }))} valeurs={p.contrats} onChange={(contrats) => maj({ contrats })} />
    ),
  },
  {
    cle: 'dispo',
    titre: 'À partir de quand es-tu disponible ?',
    repondu: (p) => p.dispo !== null,
    champ: (p, maj) => (
      <Choix
        valeur={p.dispo}
        onChange={(dispo) => maj({ dispo })}
        options={[
          { v: moisDans(0), label: 'Tout de suite' },
          { v: moisDans(1), label: 'Dans un mois', aide: 'Préavis court.' },
          { v: moisDans(3), label: 'Dans trois mois', aide: 'Préavis classique.' },
          { v: moisDans(6), label: 'Dans six mois ou plus' },
          { v: null, label: 'Je ne sais pas encore', aide: 'Le critère est ignoré.' },
        ]}
      />
    ),
  },
  {
    cle: 'salaireMin',
    titre: 'En dessous de quel salaire mensuel n’irais-tu pas ?',
    aide: 'Ne pas répondre n’enlève aucun point : le critère est simplement ignoré.',
    repondu: (p) => p.salaireMin !== null,
    champ: (p, maj) => (
      <Choix
        valeur={p.salaireMin}
        onChange={(salaireMin) => maj({ salaireMin })}
        options={[
          { v: null, label: 'Je préfère ne pas le dire', aide: 'Le critère salaire sera neutralisé.' },
          { v: 250000, label: '250 000 XPF' },
          { v: 300000, label: '300 000 XPF' },
          { v: 350000, label: '350 000 XPF' },
          { v: 400000, label: '400 000 XPF' },
          { v: 500000, label: '500 000 XPF et plus' },
        ]}
      />
    ),
  },
  {
    cle: 'teletravail',
    titre: 'Le télétravail, pour toi ?',
    repondu: () => true,
    champ: (p, maj) => (
      <Choix
        valeur={p.teletravail}
        onChange={(teletravail) => maj({ teletravail })}
        options={[
          { v: 'peu importe' as const, label: 'Peu importe' },
          { v: 'hybride' as const, label: 'J’aimerais quelques jours' },
          { v: 'total' as const, label: 'Je le veux complet' },
          { v: 'non' as const, label: 'Je préfère être sur site' },
        ]}
      />
    ),
  },
  {
    cle: 'refus',
    titre: 'Y a-t-il des choses que tu refuses ?',
    aide: 'Rien de coché est une réponse valable. Un AVP qui les mentionne restera dans ton deck, avec un avertissement : cette application n’escamote pas d’offre, elle dit ce qui ne colle pas.',
    repondu: () => true,
    champ: (p, maj) => (
      <Puces id="qz-refus" liste={REFUS} valeurs={p.refus} onChange={(refus) => maj({ refus })} />
    ),
  },
  {
    cle: 'permis',
    titre: 'As-tu le permis B ?',
    aide: 'Non renseigné n’élimine jamais un AVP : ça devient un point à vérifier.',
    repondu: (p) => p.permis !== null,
    champ: (p, maj) => (
      <Choix
        valeur={p.permis}
        onChange={(permis) => maj({ permis })}
        options={[
          { v: true, label: 'Oui' },
          { v: false, label: 'Non' },
          { v: null, label: 'Je préfère ne pas répondre' },
        ]}
      />
    ),
  },
]

export function Questions({ profil, maj, ref_, onFin, onQuitter }: {
  profil: Profil
  maj: Maj
  ref_: Referentiels | null
  onFin: () => void
  onQuitter: () => void
}) {
  const [i, setI] = useState(0)
  const q = QUESTIONS[i]
  // `noUncheckedIndexedAccess` : l'index peut sortir du tableau pour le
  // compilateur. Il ne le peut pas ici, mais le dire coute une ligne.
  if (!q) {
    return null
  }
  const dernier = i === QUESTIONS.length - 1

  return (
    <section className="qz" aria-labelledby="qz-titre">
      <div className="qz-haut">
        <span className="qz-pas">Question {i + 1} sur {QUESTIONS.length}</span>
        <button type="button" className="btn-mini" onClick={onQuitter}>Fermer</button>
      </div>

      <div className="qz-jauge" role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={i + 1}>
        {QUESTIONS.map((x, k) => <i key={x.cle} className={k <= i ? 'on' : ''} />)}
      </div>

      <h3 id="qz-titre" className="qz-titre">{q.titre}</h3>
      {q.aide && <p className="qz-aide">{q.aide}</p>}

      <div className="qz-champ">{q.champ(profil, maj, ref_)}</div>

      <div className="qz-bas">
        {i > 0
          ? <button type="button" className="btn-mini" onClick={() => setI(i - 1)}>← Précédent</button>
          : <span />}
        <button
          type="button"
          className="btn-fort"
          onClick={() => (dernier ? onFin() : setI(i + 1))}
        >
          {dernier ? 'Terminer' : q.repondu(profil) ? 'Suivant →' : 'Passer →'}
        </button>
      </div>

      <p className="qz-note">
        Chaque réponse est enregistrée tout de suite. Tu peux fermer et reprendre plus tard :
        rien n’est perdu, et tout reste modifiable dans le formulaire.
      </p>
    </section>
  )
}
