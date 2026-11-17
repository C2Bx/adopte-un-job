import { useEffect, useState } from 'react'
import { Feuille } from '../Dialogue'
import { useLocal } from './OutilsOffres'

export function Aide({ onGuide }: { onGuide: () => void }) {
  const [ouverte, setOuverte] = useState(false)
  const [affichage, setAffichage, erreur] = useLocal('affichage', { taille: 'normale', densite: 'confort' })
  useEffect(() => {
    document.documentElement.dataset.taille = affichage.taille
    document.documentElement.dataset.densite = affichage.densite
  }, [affichage])
  return <><button type="button" className="btn-mini ui-aide-bouton" onClick={() => setOuverte(true)} aria-haspopup="dialog" title="Guide et aide">Guide</button>
    {ouverte && <Feuille titre="Aide et affichage" onFermer={() => setOuverte(false)}>
      <div className="upgrade-aide aide-lecture">
        <section className="guide-demarrage aide-bienvenue" aria-labelledby="aide-guide">
          <span className="aide-repere">Pas à pas</span>
          <h3 id="aide-guide">Prends tes repères sur cette page</h3>
          <p>Le tutoriel met chaque commande en lumière. Avance à ton rythme avec Suivant et Précédent, ou arrête quand tu veux.</p>
          <button type="button" className="btn primaire" onClick={() => { setOuverte(false); onGuide() }}>Démarrer le tutoriel <span aria-hidden="true">→</span></button>
        </section>

        <section className="aide-reglages" aria-labelledby="aide-affichage">
          <div><h3 id="aide-affichage">Ton confort de lecture</h3><p>Les réglages s’appliquent immédiatement et restent dans ce navigateur.</p></div>
          <div className="upgrade-rangee">
            <label>Taille du texte <select value={affichage.taille} onChange={(e) => setAffichage({ ...affichage, taille: e.target.value })}><option value="normale">Normale</option><option value="grande">Grande</option><option value="tres-grande">Très grande</option></select></label>
            <label>Densité <select value={affichage.densite} onChange={(e) => setAffichage({ ...affichage, densite: e.target.value })}><option value="confort">Confortable</option><option value="compacte">Compacte</option></select></label>
          </div>
          {erreur && <p role="alert">Ce réglage ne peut pas être mémorisé dans le navigateur.</p>}
        </section>

        <section aria-labelledby="aide-parcours">
          <h3 id="aide-parcours" className="aide-titre">Quatre menus, un parcours simple</h3>
          <ol className="aide-parcours">
            <li><span aria-hidden="true">01</span><div><h4>Offres</h4><p>Explore les cartes, la liste ou le tableau. Affine avec les filtres et garde tes favoris.</p></div></li>
            <li><span aria-hidden="true">02</span><div><h4>Comparaison</h4><p>Ajoute deux ou trois offres avec Comparer, puis retrouve leurs critères dans ce menu dédié.</p></div></li>
            <li><span aria-hidden="true">03</span><div><h4>Profil</h4><p>Complète et relis ton dossier. Le repère « Enregistré » confirme sa sauvegarde.</p></div></li>
            <li><span aria-hidden="true">04</span><div><h4>Candidatures</h4><p>Retrouve tes choix et les réponses reçues. Le suivi s’actualise automatiquement.</p></div></li>
          </ol>
        </section>

        <div className="aide-sujets">
          <details open><summary><span className="aide-icone" aria-hidden="true">↔</span>Gestes et raccourcis</summary>
            <div className="aide-contenu">
              <dl className="aide-raccourcis"><div><dt><kbd>←</kbd></dt><dd>Passer l’offre</dd></div><div><dt><kbd>→</kbd></dt><dd>Préparer ma candidature</dd></div><div><dt><kbd>↑</kbd> <kbd>↓</kbd></dt><dd>Mettre en favori</dd></div><div><dt><kbd>Échap</kbd></dt><dd>Fermer une fenêtre</dd></div></dl>
              <p><strong>À la souris</strong> — Maintiens le clic gauche sur la carte et glisse à gauche, à droite ou vers le haut.</p>
              <p><strong>Au tactile</strong> — Glisse vers le haut depuis la poignée pour un favori. Le texte de l’offre reste défilable.</p>
              <p className="aide-note">Tu peux aussi utiliser les boutons : ils font les mêmes actions.</p>
            </div>
          </details>
          <details><summary><span className="aide-icone" aria-hidden="true">⌕</span>Rechercher plus précisément</summary>
            <div className="aide-contenu"><p>Les mots saisis sont combinés pour affiner les résultats.</p>
              <dl className="aide-exemples"><div><dt><code>conseiller clientèle</code></dt><dd>Rechercher les deux mots.</dd></div><div><dt><code>"relation client"</code></dt><dd>Retrouver cette expression exacte.</dd></div><div><dt><code>conseiller -stage</code></dt><dd>Exclure le mot « stage ».</dd></div></dl>
            </div>
          </details>
          <details><summary><span className="aide-icone" aria-hidden="true">✓</span>Comprendre les réponses</summary>
            <div className="aide-contenu"><dl className="aide-statuts"><div><dt>En attente</dt><dd>Aucune décision reçue. Cela ne signifie pas que ton dossier a été lu.</dd></div><div><dt>Retenue / Non retenue</dt><dd>La décision communiquée par le recruteur.</dd></div><div><dt>Entretien à programmer</dt><dd>Visible uniquement si le recruteur le signale.</dd></div></dl>
              <p className="aide-note"><strong>Le score d’adéquation</strong> décrit les compétences rapprochées par CV-Matching. Il ne décide pas de ton recrutement.</p>
            </div>
          </details>
          <details><summary><span className="aide-icone" aria-hidden="true">▣</span>Où sont gardées mes données ?</summary>
            <div className="aide-contenu"><dl className="aide-statuts"><div><dt>Dans ce navigateur</dt><dd>Favoris, notes, étiquettes, recherches et sélection à comparer.</dd></div><div><dt>Dans cet onglet</dt><dd>Brouillons de profil et copie de secours avant import.</dd></div><div><dt>Sur ton compte</dt><dd>Profil et CV enregistrés, candidatures confirmées et réponses disponibles.</dd></div></dl>
              <p className="aide-note">Les repères locaux ne sont pas synchronisés entre navigateurs ou appareils.</p>
            </div>
          </details>
        </div>

        <aside className="aide-attention" aria-label="Avant d’envoyer une candidature">
          <span aria-hidden="true">!</span><div><h3>Avant d’envoyer</h3><p>Relis ton dossier, puis clique sur <strong>Confirmer ma candidature</strong> lorsque la relecture est activée. Fermer ou Annuler n’envoie rien.</p><p>En cas d’erreur réseau, vérifie le suivi dans Candidatures avant de réessayer. Les offres archivées restent en lecture seule.</p></div>
        </aside>
      </div>
    </Feuille>}
  </>
}
