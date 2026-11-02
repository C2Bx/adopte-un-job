const RUBRIQUES: Record<string, string> = { basics: 'Identité et présentation', work: 'Expériences', education: 'Formations', skills: 'Compétences', projects: 'Projets', volunteer: 'Bénévolat', certificates: 'Certifications', languages: 'Langues', awards: 'Distinctions', publications: 'Publications', interests: 'Centres d’intérêt', references: 'Références' }
const LIBELLES: Record<string, string> = { name: 'Nom / intitulé', label: 'Titre professionnel', summary: 'Résumé', email: 'E-mail', phone: 'Téléphone', position: 'Poste', startDate: 'Début', endDate: 'Fin', highlights: 'Réalisations', institution: 'Établissement', area: 'Domaine', studyType: 'Diplôme', keywords: 'Mots-clés', language: 'Langue', fluency: 'Niveau', url: 'Lien', description: 'Description', issuer: 'Organisme', date: 'Date', network: 'Réseau', username: 'Identifiant' }
export function champsDocument(doc: Record<string, unknown>): { chemin: string; nom: string; texte: string }[] {
  const out: { chemin: string; nom: string; texte: string }[] = []
  const visite = (valeur: unknown, chemin: string, nom: string, profondeur: number) => {
    if (valeur === null || valeur === undefined || valeur === '') return
    if (Array.isArray(valeur)) {
      if (valeur.every((x) => typeof x === 'string')) { if (valeur.length) out.push({ chemin, nom, texte: valeur.join(' · ') }); return }
      valeur.forEach((v, i) => visite(v, `${chemin}.${i}`, `${nom} ${i + 1}`, profondeur + 1)); return
    }
    if (typeof valeur === 'object' && profondeur < 5) { for (const [k, v] of Object.entries(valeur)) visite(v, `${chemin}.${k}`, `${nom} — ${LIBELLES[k] ?? k}`, profondeur + 1); return }
    if (typeof valeur !== 'object') out.push({ chemin, nom, texte: String(valeur) })
  }
  for (const [k, nom] of Object.entries(RUBRIQUES)) if (doc[k] !== undefined) visite(doc[k], k, nom, 0)
  return out
}

export function ApercuDocument({ document, avant, selection, onSelection }: {
  document: Record<string, unknown>; avant?: Record<string, unknown>; selection?: string[]; onSelection?: (choix: string[]) => void
}) {
  const champs = champsDocument(document)
  const anciens = new Map(avant ? champsDocument(avant).map((x) => [x.chemin, x.texte]) : [])
  const nouveaux = new Map(champs.map((x) => [x.chemin, x]))
  const chemins = [...new Set([...anciens.keys(), ...nouveaux.keys()])]
  return <div className="upgrade-apercu">
    {!chemins.length && <p>Aucune rubrique de CV reconnue à afficher.</p>}
    <dl>{chemins.map((chemin) => {
      const champ = nouveaux.get(chemin); const ancien = anciens.get(chemin)
      return <div key={chemin}>
        <dt>{onSelection && champ && <input type="checkbox" aria-label={`Retenir ${champ.nom}`} checked={selection?.includes(chemin) ?? false} onChange={(e) => onSelection(e.target.checked ? [...(selection ?? []), chemin] : (selection ?? []).filter((x) => x !== chemin))} />} {champ?.nom ?? chemin}</dt>
        {avant && <dd><b>Actuellement : </b>{ancien ?? 'Absent'}</dd>}
        <dd>{avant && <b>Proposé : </b>}{champ?.texte ?? 'Supprimé par cet import'}</dd>
      </div>
    })}</dl>
  </div>
}
