# Adopte un Job

Un poste qui te correspond, pas trente CV envoyés. L'interface candidat du
**#HackAVP** (OPT-NC · Station N · OPEN NC), premier hackathon dédié à l'emploi
dans la fonction publique en Nouvelle-Calédonie : on fait défiler les **vrais
avis de vacance de poste de l'OPT-NC**, à droite pour candidater, à gauche pour
passer.

## Une interface, rien d'autre

Depuis le 5 octobre 2026, Adopte un Job **ne garde rien** : ni base de données,
ni API à lui, ni CV. Il affiche ce que **HACKAVPI**, l'API commune tenue par **Dan et Timothée**, lui
donne, et lui transmet ce que la personne saisit.

| Ce que fait la personne | Où ça vit |
|---|---|
| Crée son compte, se connecte, change son mot de passe | **HACKAVPI** (`/auth/*`) |
| Remplit son profil (à la main, par neuf questions, ou depuis son CV) | **HACKAVPI** (`/profils/moi`), au format JSON Resume |
| Dépose son CV (PDF, PNG, JPEG) | **HACKAVPI** (`/profils/moi/cv`), lu par **CVForge**, le module d'extraction de **Florian** |
| Fait défiler les offres, swipe, suit ses candidatures | **HACKAVPI** (`/avp`, `/swipes/candidats`, `/candidatures/moi`) |
| Voit à qui s'adresser pour candidater | L'avis lui-même (`contactEmail`, `contactTelephone`), affiché dans le détail de l'offre |
| Suit la réponse du recruteur | **HACKAVPI** (`statut`, `entretienAProg`), posée depuis **AVPRO-NC**, l'espace recruteur de **Damien et Lucas** |
| Voit son adéquation à chaque offre | **CV-Matching**, le module de **Jo-Michel** (`POST /v1/match`, `POST /v1/score`), via le relais : le CV y part sans identité |
| Met une offre « à plus tard » | Son navigateur (leur API ne le connaît pas) |

## L'équipe et les modules

Adopte un Job est **MS3, le front candidat**. Il ne fonctionne pas seul : chaque module a son
responsable, et ils se parlent par un seul format, le **JSON Resume**.

| | Module | Qui | Ce qu'il fait |
|---|---|---|---|
| MS1 | **CVForge** | Florian | lit le CV déposé et en tire un JSON Resume |
| MS2 | **HACKAVPI** | Dan et Timothée | l'API commune : comptes, offres, profils, CV, candidatures |
| **MS3** | **Adopte un Job** | **Bastian — ce dépôt** | le front candidat |
| MS4 | **CV Generator** | Anthony et Kim | CV et lettre de motivation |
| MS5 | **CV-Matching** | Jo-Michel | le calcul de compatibilité |
| MS6 | **AVPRO-NC** | Damien et Lucas | l'espace recruteur |
| MS7 | **Insight Squad** | Élodie et Mathieu | les indicateurs, les rapports et le tableau de bord Power BI |

Le calcul de compatibilité, la lettre de motivation et la préparation d'entretien ne sont **pas**
dans ce dépôt : ils appartiennent à MS5 et MS4. L'application **affiche** l'adéquation que calcule
CV-Matching ; elle ne la calcule pas.

**La lecture du CV ne remplace jamais une saisie.** Le traitement de Florian range
sa lecture à part (`cvJsonGenere`) ; l'interface ne la recopie dans le profil
(`cv`, dont le candidat reste le seul rédacteur) que si le parcours est encore vide.

## Ce qu'il y a dans ce dépôt

| Fichier | Rôle |
|---|---|
| `beta/` | L'application : React 19 + TypeScript strict, Vite. Sortie 100 % statique. Trois écrans : le deck, les candidatures, le profil. |
| `beta/src/api.ts` | Le seul endroit qui parle à leur API, et qui traduit leurs réponses dans les formes que les écrans connaissent. |
| `beta/src/filtres.ts` | Les filtres du deck, calculés dans le navigateur : plusieurs choix par catégorie (OU), catégories combinées (ET), compteurs dynamiques. |
| `beta/public/relais.php` | Un relais **sans état** vers leur API, tant qu'elle n'envoie pas d'en-têtes CORS, et vers CV-Matching. Il ne relaie que les routes listées, chacune avec sa seule méthode. Pour CV-Matching, il ajoute la clé du service côté serveur et ne transmet jamais le jeton de l'utilisateur. |
| `beta/src/ecrans/Adequation.tsx` | L'adéquation au poste : pastille, et tableau de bord dans le détail de l'offre (jauge, indicateurs, une barre par compétence). |
| `beta/public/referentiel.json` | Les 84 métiers et 409 compétences du référentiel OPT-NC, servis comme un fichier. |
| `scripts/referentiel_statique.py` | Régénère ce fichier depuis la [publication officielle de l'OPT](https://github.com/opt-nc/odata-referentiel-metiers). |
| `demo/` | La démo de départ, en HTML/CSS/JS sans dépendance ni étape de build, sur des offres fictives. Elle s'ouvre sans compte ni API. Son pourcentage de compatibilité maison a ensuite été retiré de l'application : ce calcul revient à CV-Matching (MS5), que l'application affiche désormais. |

## Démarrer

**La démo** (`demo/`) n'a besoin de rien : ouvre `demo/index.html` dans un
navigateur. Pour profiter du mode hors ligne (service worker), sers plutôt le
dossier en local :

```bash
python -m http.server 8000 --directory demo
```

puis ouvre <http://localhost:8000/>.

**L'application** (`beta/`) parle à l'API à travers `relais.php`. En
développement, indique à Vite l'origine qui sert ce relais avec la variable
d'environnement `RELAIS_ORIGINE` (dans `beta/.env.local`, jamais versionné, ou
dans le shell) : Vite y renverra `/avp/relais.php`. Sans elle, aucun proxy n'est
configuré.

```bash
cd beta
npm ci
echo "RELAIS_ORIGINE=https://ton-serveur.example" > .env.local
npm run dev        # http://localhost:5173/avp/
npm run build      # dist/ : à déposer tel quel sous /avp/
```

## L'interface en bref

- **Accueil** : inscription (avec « Es-tu déjà agent de l'OPT-NC ? », transmis à leur API), connexion, mot de passe oublié, nombre de postes ouverts en ce moment.
- **Swipe** : sur grand écran, filtres et détail de l'offre à gauche (65 %), carte à droite (35 %) sur toute la hauteur ; on glisse depuis n'importe quel point de la carte. Sur téléphone, recherche et filtres dans la barre du haut. Carte claire, bordure et détails bleu sombre, touches orange (direction artistique « a » de la maquette).
- **Adéquation** : pastille « Bonne adéquation · 42 % » sur la carte, et dans le détail un tableau de bord : jauge, compétences couvertes, rang de l'offre parmi toutes, savoir-être, prérequis, et la note de chaque compétence avec la preuve tirée du profil.
- **Filtres** : une barre (recherche, bouton Filtres, filtres actifs retirables, nombre d'offres) et un panneau par sections, avec cases à cocher et bascule offres ouvertes / closes.
- **Candidatures** : la décision du recruteur lue dans leur API, les jours restants avant clôture, l'adéquation.
- **Profil** : à la main, par neuf questions ou depuis le CV. À l'enregistrement, les champs que l'écran n'affiche pas (résumé, réalisations, établissement, mots-clés) sont conservés. Export et import au format JSON Resume, effacement du CV saisi.
- **Thème** : jour par défaut, nuit au choix : bouton lune / soleil dans la barre du haut et sur l'accueil (ou *Mon compte* → Apparence), mémorisé dans le navigateur.
- L'onglet courant vit dans l'adresse (`#swipe`, `#candidatures`, `#profil`) : un F5 reste sur place.

## Ce qu'il faut savoir

- **Le relais transmet le jeton** grâce au `.htaccess` (`SetEnvIf Authorization`) : sans lui, Apache le retire et toutes les routes connectées répondent 401.
- **La session** est le jeton de leur API, valable une heure et sans
  renouvellement. Elle vit dans `sessionStorage` : elle survit à un rechargement,
  pas à la fermeture de l'onglet.
- **L'adéquation** vient de CV-Matching (MS5). Le relais y envoie le contenu du
  CV **sans identité** (ni nom, ni e-mail, ni téléphone, ni adresse). **Sa clé ne vit
  jamais dans ce dépôt ni dans le code envoyé au navigateur** : `relais.php` la lit
  dans `_secrets.php`, posé à côté de lui au déploiement. Sans ce fichier, le relais
  répond 503 et l'application n'affiche simplement pas l'adéquation.
- **Formats de CV** : PDF, PNG, JPEG, 10 Mo. C'est la limite de leur API, qui
  doit s'ouvrir à d'autres formats.
