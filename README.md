# Adopte un Job

Un poste qui te correspond, pas trente CV envoyés. L'interface candidat du
**#HackAVP** (OPT-NC · Station N · OPEN NC), premier hackathon dédié à l'emploi
dans la fonction publique en Nouvelle-Calédonie : on fait défiler les **vrais
avis de vacance de poste de l'OPT-NC**, à droite pour candidater, à gauche pour
passer.

## Une interface, rien d'autre

Depuis le 5 octobre 2026, Adopte un Job **ne garde rien** : ni base de données,
ni API à lui, ni CV. Il affiche ce que **HACKAVPays**, l'API commune tenue par **Dan et Timothée**, lui
donne, et lui transmet ce que la personne saisit.

| Ce que fait la personne | Où ça vit |
|---|---|
| Crée son compte, se connecte, change son mot de passe | **HACKAVPays** (`/auth/*`) |
| Remplit son profil (à la main, par neuf questions, ou depuis son CV) | **HACKAVPays** (`/profils/moi`), au format JSON Resume |
| Dépose son CV (PDF, PNG, JPEG) | **HACKAVPays** (`/profils/moi/cv`), lu par **CVForge**, le module d'extraction de **Florian** |
| Fait défiler les offres, swipe, suit ses candidatures | **HACKAVPays** (`/avp`, `/swipes/candidats`, `/candidatures/moi`) |
| Voit à qui s'adresser pour candidater | L'avis lui-même (`contactEmail`, `contactTelephone`), affiché dans le détail de l'offre |
| Suit la réponse du recruteur | **HACKAVPays** (`statut`, `entretienAProg`), posée depuis **AVPRO-NC**, l'espace recruteur de **Damien et Lucas** |
| Met une offre « à plus tard » | Son navigateur (leur API ne le connaît pas) |

## L'équipe et les modules

Adopte un Job est **MS3, le front candidat**. Il ne fonctionne pas seul : chaque module a son
responsable, et ils se parlent par un seul format, le **JSON Resume**.

| | Module | Qui | Ce qu'il fait |
|---|---|---|---|
| MS1 | **CVForge** | Florian | lit le CV déposé et en tire un JSON Resume |
| MS2 | **HACKAVPays** | Dan et Timothée | l'API commune : comptes, offres, profils, CV, candidatures |
| **MS3** | **Adopte un Job** | **Bastian — ce dépôt** | le front candidat |
| MS4 | **CV Generator** | Anthony et Kim | CV et lettre de motivation |
| MS5 | **CV-Matching** | Jo-Michel | le calcul de compatibilité |
| MS6 | **AVPRO-NC** | Damien et Lucas | l'espace recruteur |
| MS7 | **Inside Squad** | Élodie et Mathieu | les indicateurs, les rapports et le tableau de bord Power BI |
| — | *(pilotage)* | Maud | pilotage, tests, qualification |

Le calcul de compatibilité, la lettre de motivation et la préparation d'entretien ne sont **pas**
dans ce dépôt : ils appartiennent à MS5 et MS4.

**La lecture du CV ne remplace jamais une saisie.** Leur traitement remplace le
profil : l'interface ne le lance que si le parcours est encore vide.

## Ce qu'il y a dans ce dépôt

| Fichier | Rôle |
|---|---|
| `beta/` | L'application : React 19 + TypeScript strict, Vite. Sortie 100 % statique. Trois écrans : le deck, les candidatures, le profil. |
| `beta/src/api.ts` | Le seul endroit qui parle à leur API, et qui traduit leurs réponses dans les formes que les écrans connaissent. |
| `beta/src/filtres.ts` | Les filtres du deck, calculés dans le navigateur : plusieurs choix par catégorie (OU), catégories combinées (ET), compteurs dynamiques. |
| `beta/public/relais.php` | Un relais **sans état** vers leur API, tant qu'elle n'envoie pas d'en-têtes CORS. Il ne parle qu'à leur adresse, et seulement aux routes listées. |
| `beta/public/referentiel.json` | Les 84 métiers et 409 compétences du référentiel OPT-NC, servis comme un fichier. |
| `scripts/referentiel_statique.py` | Régénère ce fichier depuis la [publication officielle de l'OPT](https://github.com/opt-nc/odata-referentiel-metiers). |

## Démarrer

```bash
cd beta
npm install
npm run dev        # le relais de production répond en développement (proxy Vite)
npm run build      # dist/ : à déposer tel quel sous /avp/
```

## L'interface en bref

- **Swipe** : sur grand écran, filtres et détail de l'offre à gauche (65 %), carte à droite (35 %) sur toute la hauteur. Carte claire, bordure et détails bleu sombre, touches orange (direction artistique « a » de la maquette).
- **Filtres** : une barre (recherche, bouton Filtres, filtres actifs retirables, nombre d'offres) et un panneau par sections, avec cases à cocher et bascule offres ouvertes / closes.
- **Candidatures** : la décision du recruteur lue dans leur API, les jours restants avant clôture.
- **Profil** : à la main, par neuf questions ou depuis le CV. À l'enregistrement, les champs que l'écran n'affiche pas (résumé, réalisations, établissement, mots-clés) sont conservés.
- L'onglet courant vit dans l'adresse (`#swipe`, `#candidatures`, `#profil`) : un F5 reste sur place.

## Ce qu'il faut savoir

- **Le relais transmet le jeton** grâce au `.htaccess` (`SetEnvIf Authorization`) : sans lui, Apache le retire et toutes les routes connectées répondent 401.
- **La session** est le jeton de leur API, valable une heure et sans
  renouvellement. Elle vit dans `sessionStorage` : elle survit à un rechargement,
  pas à la fermeture de l'onglet.
- **Le score de compatibilité** relève du module de matching de l'équipe : tant
  qu'il n'est pas fourni par l'API, il n'est pas affiché.
- **Formats de CV** : PDF, PNG, JPEG, 10 Mo. C'est la limite de leur API, qui
  doit s'ouvrir à d'autres formats.
- L'ancienne version (API PHP, base MySQL, passerelle FTPS, lecture du CV dans le
  navigateur, wiki du projet) est dans l'historique git, avant le commit qui l'a
  retirée.
