# Adopte un Job

Un poste qui te correspond, pas trente CV envoyés. L'interface candidat du
**#HackAVP** (OPT-NC · Station N · OPEN NC), premier hackathon dédié à l'emploi
dans la fonction publique en Nouvelle-Calédonie : on fait défiler les **vrais
avis de vacance de poste de l'OPT-NC**, à droite pour candidater, à gauche pour
passer. Un module du projet commun de la promotion du **Master MIAGE** de
l'Université de la Nouvelle-Calédonie.

📰 **L'article de présentation** (dev.to, track *SaaS no limit*) : https://dev.to/c2b/adopte-un-job-on-swipe-les-vrais-postes-de-lopt-nc-et-on-voit-pourquoi-ils-nous-correspondent-48pc

## État de la version

La stabilisation du **27 octobre 2026** est intégrée aux sources. La compilation et les
25 tests et contrôles locaux passent ; le contrôle npm ne signale aucune vulnérabilité
au moment de cette vérification. Cette version n’est **pas encore déployée** sur le site.
Le fonctionnement complet avec les services de l’équipe reste à valider après publication.

Les opérations de mise en ligne sont décrites plus bas. Les décisions encore ouvertes
ne sont pas présentées comme des fonctionnalités livrées.

## Une interface, rien d'autre

Depuis le 5 octobre 2026, Adopte un Job n'a **ni base métier ni stockage serveur des CV**.
Les brouillons sont gardés dans l'onglet du navigateur ; des compteurs techniques temporaires
protègent le relais de matching. Il affiche ce que **HACKAVPI**, l'API commune tenue par **Dan et Timothée**, lui
donne, et lui transmet ce que la personne saisit.

| Ce que fait la personne | Où ça vit |
|---|---|
| Crée son compte, se connecte, change son mot de passe | **HACKAVPI** (`/auth/*`) |
| Remplit son profil (à la main, par neuf questions, ou depuis son CV) | **HACKAVPI** (`/profils/moi`), au format JSON Resume |
| Dépose son CV (PDF, PNG, JPEG) | **HACKAVPI** (`/profils/moi/cv`), lu par **CVForge**, le module d'extraction de **Florian** |
| Fait défiler les offres, swipe, suit ses candidatures | **HACKAVPI** (`/avp`, `/swipes/candidats`, `/candidatures/moi`) |
| Voit à qui s'adresser pour candidater | L'avis lui-même (`contactEmail`, `contactTelephone`), affiché dans le détail de l'offre |
| Suit la réponse du recruteur | **HACKAVPI** (`statut`, `entretienAProg`), posée depuis **AVPRO-NC**, l'espace recruteur de **Damien et Lucas** |
| Voit son adéquation à chaque offre | **CV-Matching**, le module de **Jo-Michel** (`POST /v1/match`, `POST /v1/score`), via le relais : sans les champs d'identité du profil |
| Met une offre « à plus tard » | Son navigateur (leur API ne le connaît pas) |

## L'équipe et les modules

Adopte un Job est **MS3, le front candidat**. Il ne fonctionne pas seul : chaque module a son
responsable. Le profil du candidat circule entre eux au format **JSON Resume** ; les offres
gardent le format des AVP.

| | Module | Qui | Ce qu'il fait |
|---|---|---|---|
| MS1 | **CVForge** | Florian | lit le CV déposé et en tire un JSON Resume |
| MS2 | [**HACKAVPI**](https://dev.to/pastek/hackavpi-dp8) | Dan et Timothée | l'API commune : comptes, offres, profils, CV, candidatures |
| **MS3** | **Adopte un Job** | **Bastian — ce dépôt** | le front candidat |
| MS4 | [**CV Generator**](https://dev.to/spewq/hackavp-cv-generator-la-solution-de-preparation-de-candidature-1p30) | Anthony et Kim | CV, lettre de motivation, guide d'entretien |
| MS5 | **CV-Matching** | Jo-Michel | le calcul de compatibilité |
| MS6 | **AVPRO-NC** | Damien et Lucas | l'espace recruteur |
| MS7 | **Insight Squad** | Élodie et Mathieu | les indicateurs, les rapports et le tableau de bord Power BI |

Le calcul de compatibilité, la lettre de motivation et la préparation d'entretien ne sont **pas**
dans ce dépôt : ils appartiennent à MS5 et MS4. L'application **affiche** l'adéquation que calcule
CV-Matching ; elle ne la calcule pas.

**La lecture du CV préserve la saisie.** Le traitement de Florian range sa lecture à part
(`cvJsonGenere`). L'interface le lance si le parcours est vide, puis relit le profil avant
de compléter les champs absents, en préservant l'identité et les métadonnées déjà saisies.
Les écritures de cet onglet sont sérialisées. Une garantie atomique entre plusieurs appareils
nécessiterait un contrat de version côté MS2.

## Ce qu'il y a dans ce dépôt

| Fichier | Rôle |
|---|---|
| `beta/` | L'application : React 19 + TypeScript strict, Vite. Sortie statique, plus le relais PHP (un hébergement PHP suffit). Trois écrans : le deck, les candidatures, le profil. |
| `beta/src/api.ts` | Le seul endroit qui parle à leur API, et qui traduit leurs réponses dans les formes que les écrans connaissent. |
| `beta/src/filtres.ts` | Les filtres du deck, calculés dans le navigateur : plusieurs choix par catégorie (OU), catégories combinées (ET), compteurs dynamiques. |
| `beta/public/relais.php` | Un relais **protégé** vers leur API, tant qu'elle n'envoie pas d'en-têtes CORS, et vers CV-Matching. Il ne relaie que les routes listées, chacune avec sa seule méthode. Pour CV-Matching, il vérifie la session auprès du hub, applique des quotas et ajoute la clé côté serveur ; le jeton n’est jamais transmis au moteur. |
| `beta/src/sauvegarde.ts` | File de sauvegarde indépendante des écrans et brouillon par compte dans l'onglet. |
| `beta/src/jsonResume.ts` | Contrôle de l'import et fusion de l'extraction dans les champs absents. |
| `beta/public/matching-securite.php` | Contrôle du jeton et quotas techniques du relais de matching. |
| `beta/scripts/test.mjs`, `beta/scripts/test-matching.php` | Régressions avec données fictives ; aucune écriture sur les services de production. |
| `.github/workflows/verification.yml` | Vérifications lors des push et demandes de fusion. |
| `beta/src/ecrans/Adequation.tsx` | L'adéquation au poste : pastille, et tableau de bord dans le détail de l'offre (jauge, indicateurs, une barre par compétence). |
| `beta/public/referentiel.json` | Les 84 métiers et 409 compétences du référentiel OPT-NC, servis comme un fichier. |
| `scripts/referentiel_statique.py` | Régénère ce fichier depuis la [publication officielle de l'OPT](https://github.com/opt-nc/odata-referentiel-metiers). |
| `demo/` | La démo de départ, en HTML/CSS/JS sans framework ni étape de build, sur des offres fictives. Elle s'ouvre sans compte ni API. Son pourcentage de compatibilité maison a ensuite été retiré de l'application : ce calcul revient à CV-Matching (MS5), que l'application affiche désormais. |

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
- **Adéquation** : pastille « Bonne adéquation · 42 % » sur la carte, et dans le détail (aussi sur téléphone) un tableau de bord : jauge, compétences couvertes, rang de l'offre parmi toutes, savoir-être, prérequis, et la note de chaque compétence ; une info-bulle claire donne la preuve tirée du profil ou ce que la compétence pèse dans le score.
- **Couleurs de l'adéquation** : le niveau donné par CV-Matching colore la pastille, la jauge et le liseré — vert pour *excellente* (≥ 75 %) et *très bonne* (≥ 50 %), bleu pour *bonne* (≥ 33 %), ambre pour *partielle* (≥ 20 %), rouge pour *faible*. Indicateurs teintés (couvertes vert, rang bleu, savoir-être orange, prérequis ambre), barres vertes (couverte) ou orange (à travailler), savoir-être en pastilles orangées, statut des prérequis en couleur. Tout passe par les jetons du thème : la nuit suit.
- **Filtres** : une barre (recherche, bouton Filtres, filtres actifs retirables, nombre d'offres) et un panneau par sections, avec cases à cocher et bascule offres ouvertes / archives en lecture seule.
- **Candidatures** : la décision du recruteur lue dans leur API, les jours restants avant clôture, l'adéquation.
- **Profil** : à la main, par neuf questions ou depuis le CV. À l'enregistrement, les champs que l'écran n'affiche pas (résumé, réalisations, établissement, mots-clés) sont conservés. Export et import au format JSON Resume, effacement du CV saisi.
- **Thème** : jour par défaut, nuit au choix : « Nuit » / « Jour » dans le menu de navigation (et un bouton lune / soleil sur l'accueil) (ou *Mon compte* → Apparence), mémorisé dans le navigateur.
- L'onglet courant vit dans l'adresse (`#swipe`, `#candidatures`, `#profil`) : un F5 reste sur place.

## Ce qu'il faut savoir

- **Le relais transmet le jeton** grâce au `.htaccess` (`SetEnvIf Authorization`) : sans lui, Apache le retire et toutes les routes connectées répondent 401.
- **La session** est le jeton de leur API, valable une heure et sans
  renouvellement. Elle vit dans `sessionStorage` : elle survit à un rechargement,
  pas à la fermeture de l'onglet.
- **L'adéquation** vient de CV-Matching (MS5). Le relais y envoie le contenu du
  CV **sans les champs d'identité** du profil (nom, e-mail, téléphone, adresse) ;
  les textes libres (résumé, expériences…) partent tels quels. **Sa clé ne vit
  jamais dans ce dépôt ni dans le code envoyé au navigateur** : `relais.php` la lit
  dans `_secrets.php`, posé à côté de lui au déploiement. Sans ce fichier, le relais
  répond 503 et l'application n'affiche simplement pas l'adéquation.
- **Formats de CV** : PDF, PNG, JPEG, 10 Mo. C'est la limite de leur API, qui
  doit s'ouvrir à d'autres formats.

## L'article et ses visuels

`docs/article/` contient les images de l'article dev.to : couverture, vignette de la
vidéo (image tirée de la démo), schéma du projet commun, schéma « sous le capot »,
captures du deck et du tableau d'adéquation (profil de test fictif), logo. L'article
les cite par une adresse figée sur un commit (`raw.githubusercontent.com/…/<sha>/…`) :
le cache de GitHub ignore les paramètres d'URL, une adresse figée garantit que dev.to
affiche la bonne version.


## Stabilisation du 27 octobre 2026

La sauvegarde vit au niveau de l’application et survit au changement d’écran. Les écritures
sont sérialisées ; un brouillon par compte reste dans `sessionStorage`, récupérable dans
le même onglet à la reconnexion. La fermeture de l’onglet efface ce stockage.
L’import JSON Resume contrôle les rubriques et leur forme (1 Mo maximum), présente une
confirmation et conserve une copie récupérable du profil précédent dans l’onglet.
Un profil indisponible affiche un écran de reprise, au lieu d’un profil vide.

Les préférences accompagnent le profil ; elles ne filtrent pas automatiquement le deck et ne
modifient pas le score de compétences. Les filtres du deck restent explicites.
Les compétences OPT participent à la complétude ; une date d’expérience vidée reste effacée.
Une information d’offre absente reste non renseignée. Les archives sont en lecture seule.
Les feuilles gèrent le focus, la fermeture par Échap et le retour au déclencheur.

### Protection du matching

Le navigateur envoie son jeton au relais, qui le fait valider sur une route candidat du hub.
Le jeton n’est jamais transmis à CV-Matching. Le relais impose 1 Mo par demande, 30 demandes/minute
et 2 calculs simultanés par candidat, 120 demandes/minute et 8 simultanées par IP, et un plafond
global de 180 demandes/minute et 8 calculs simultanés. Les compteurs d’IP et de compte utilisent
des identifiants HMAC, sans jeton, CV ou IP en clair. Les fichiers sont hors du site, dans le
répertoire temporaire PHP propre à l’installation, avec droits privés ; les fenêtres durent
60 secondes et les baux abandonnés expirent après 75 secondes. Les fichiers inactifs depuis
plus d’une heure sont nettoyés à l’activité. Si le stockage temporaire est indisponible, le
matching répond 503, sans bloquer le reste de l’application. Ces limites sont locales à un
serveur PHP ; plusieurs serveurs exigeraient un limiteur partagé.

### Vérifications

```sh
cd beta
npm ci --ignore-scripts
npm test
npm run test:php
npm run build
npm audit
```

Les tests utilisent des profils fictifs et des réponses simulées ; ils ne créent ni compte ni
candidature sur les services réels. Le pipeline GitHub est configuré pour exécuter les mêmes vérifications à chaque push ou demande de fusion ; son résultat distant se contrôle dans Actions. PHP 8.1+
et l’extension cURL sont nécessaires au relais. Le développement exige Node 20.19+ ou 22.12+.

### Déploiement

Les outils du Drive utilisent `tls_deploiement.py` : vérification des certificats et
du nom d’hôte pour Plesk et FTPS. `ADOPTE_CA_BUNDLE` peut désigner une autorité supplémentaire ;
le certificat Avast du poste est ajouté lorsqu’il est présent.

`depose.py` refuse un dépôt modifié, un commit différent de son suivi distant, une clé de matching
manquante ou un `dist` dont `version.json` ne correspond pas au commit propre. Les fichiers sont
transférés sous un nom temporaire, leur taille est contrôlée puis ils sont renommés. Les assets
et l’aide de sécurité précèdent le relais ; `index.php` bascule en dernier. Il ne s’agit pas
d’une transaction atomique de toute la version : conserver les anciens assets et prévoir une
recette après publication. Un ancien onglet doit être rechargé après ce changement du relais.

La suppression du compte et du document CV, le changement d’adresse, le renouvellement de session,
les indicateurs MS7 et la rotation d’une ancienne clé dev.to restent des sujets de service ou de
pilotage. Ils ne sont pas simulés par le front. L’export JSON concerne le profil structuré ;
l’effacement du CV JSON ne supprime ni le fichier déposé ni l’extraction n8n.
