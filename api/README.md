# API — Adopte un Job

PHP 8, MySQL 8, **REST en JSON**, un seul point d'entrée : `index.php`. Pas de
framework. La description complète des routes est servie par l'API elle-même,
en **OpenAPI 3.1** : `GET /openapi.json`.

| Fichier | Rôle |
|---|---|
| `index.php` | Le routeur, le compte, le profil, les offres, les décisions, les messages ; charge les domaines ci-dessous |
| `noyau.php` | Réponses JSON, lecture des entrées, sessions, journal d'accès, notifications |
| `securite.php` | En-têtes de sécurité, CORS, vérification d'origine, limites de débit, clés d'API, chiffrement des fichiers, file d'e-mails |
| `depot.php` | Accès aux données : profil complet, offre garnie, ce qu'une organisation voit d'un candidat avant et après présélection |
| `referentiel.php` | Le référentiel OPT-NC (12 familles, 84 métiers, 409 compétences) et le rattachement des compétences libres |
| `score.php` | Le moteur de score v2 (`ALGO`), écrit dans `match_scores` |
| `opt.php` | Import et synchronisation des AVP réels, appels sortants vers l'API OPT-NC |
| `documents.php` | CV recentré (PDF, FPDF vendu dans `lib/`), propositions de messages, iCalendar |
| `cv.php` `compte.php` `organisation.php` `avp.php` `candidatures.php` `agenda.php` `tableau.php` | Un domaine par fichier, ses fonctions et ses routes |
| `doc.php` | Le tableau des routes documentées et le document OpenAPI |
| `config.php` | **À créer** depuis `config.example.php`. Jamais versionné. Lit `private/avp.env` ou `api/.env` |
| `schema.sql` + `migrations/` | 46 tables, rejouable (`CREATE TABLE IF NOT EXISTS`, `ALTER` gardés par `scripts/migre.py`) |
| `.htaccess` | Fait passer l'en-tête `Authorization` à PHP (voir *Pièges*) |

## Installation

```bash
cp config.example.php config.php
# les secrets vont dans un fichier CLE=VALEUR hors du docroot (private/avp.env) ou dans api/.env :
#   AVP_DB_HOST AVP_DB_NAME AVP_DB_USER AVP_DB_PASS
#   AVP_IP_SEL      php -r 'echo bin2hex(random_bytes(16));'   # empreinte des adresses IP dans le journal
#   AVP_CV_CLE      php -r 'echo bin2hex(random_bytes(32));'   # AES-256-GCM des fichiers de CV
#   AVP_SYNC_TOKEN  php -r 'echo bin2hex(random_bytes(24));'   # POST admin/sync/avp
#   AVP_ORIGINES    origines autorisées (CORS), séparées par des virgules
#   AVP_FICHIERS_DIR (facultatif, défaut : private/avp-fichiers hors docroot)
#   OPT_API_KEY     (facultatif : sans clé, les AVP viennent du dataset public Hugging Face)
AVP_DB_HOST=… AVP_DB_USER=… AVP_DB_PASS=… AVP_DB_NAME=… python ../scripts/migre.py
```

`migre.py` applique le schéma, les migrations, les référentiels maison, puis
télécharge le référentiel des métiers OPT-NC (release `v2.0.1`, SQLite) et le
charge. Idempotent. Puis une première synchronisation des AVP :

```bash
curl -X POST -H "X-Sync-Token: $AVP_SYNC_TOKEN" -H "Content-Type: application/json" -d '{}' \
     https://…/api/index.php?r=admin/sync/avp
```

Le `-d '{}'` n'est pas décoratif : un pare-feu applicatif (ModSecurity) refuse
un `POST` sans `Content-Length`. Cette commande est celle du cron ; elle ferme
les AVP disparus ou expirés et invalide les scores des offres mises à jour.
Avec le jeton, `GET admin/sync/avp` renvoie aussi le **code d'invitation de
l'organisation OPT-NC** : c'est ainsi qu'un premier compte RH la rejoint.

## Appeler l'API

Deux formes d'URL, équivalentes :

```
https://…/api/index.php/profil          (PATH_INFO)
https://…/api/index.php?r=profil        (paramètre r, si le serveur ne passe pas PATH_INFO)
```

Corps en **JSON** (`Content-Type: application/json`), sauf le dépôt de fichier
(`multipart/form-data`). Réponses en JSON UTF-8, `Cache-Control: no-store`.
Identifiants numériques entiers ; dates en `YYYY-MM-DD HH:MM:SS` **UTC** (le
client affiche l'heure locale). Un corps JSON est plafonné à 1 Mo, un fichier
à 10 Mo.

### Authentification

Trois moyens, selon le client :

| Client | Transport | Durée |
|---|---|---|
| Navigateur | Cookie `avp_sid` — `HttpOnly`, `Secure`, `SameSite=Lax`, chemin `/avp/`, posé par l'API | 30 jours |
| Application native, script | `Authorization: Bearer <jeton>` (64 hexadécimaux, rendu à la connexion) | 30 jours |
| Intégration (tableur, Power BI, robot) | `Authorization: Bearer aj_<prefixe>.<secret>` — clé créée par `POST cles`, secret montré une fois, révocable | jusqu'à révocation |

La session est **renouvelée à la connexion** et liée à une empreinte du
navigateur. Mots de passe hachés en **Argon2id**, 12 caractères minimum, sans
règle de composition ; la connexion répond la même chose, dans le même temps,
que le compte existe ou non (hachage factice). Réinitialisation et vérification
d'e-mail existent (`auth/reinit`, `auth/verification`) : les codes sont mis en
**file d'attente** (`email_queue`), **aucun e-mail ne part** — l'envoi est un
choix à faire (fournisseur, domaine), pas un oubli.

### Rôles et organisations

`candidat` (par défaut), `recruteur`, `admin`. Un recruteur appartient à une
**organisation** (`companies`) avec un rôle interne : `proprietaire`,
`recruteur`, `lecteur`. **Plusieurs comptes RH partagent les mêmes offres, les
mêmes candidatures et le même tableau de bord.** On rejoint une organisation
par son code d'invitation (à l'inscription ou après), ou on la crée. Une route
qui exige un rôle répond `403 role_insuffisant`.

## Les routes

Le détail (paramètres, réponses, codes d'erreur) est dans `GET /openapi.json`.
Ce qui suit est la carte.

### Compte

`POST auth/inscription` (candidat, ou recruteur avec `organisation` ou `code`) ·
`POST auth/connexion` · `POST auth/deconnexion` · `GET auth/moi` ·
`PUT auth/motdepasse` · `GET/DELETE auth/sessions` · `POST auth/reinit`,
`auth/reinit/confirme` · `POST auth/verification`, `auth/verification/renvoi` ·
`GET auth/export` (portabilité) · `DELETE auth/compte` (anonymisation : e-mail
irréversible, fichiers supprimés, candidatures retirées, clés révoquées,
organisation quittée, entretiens annulés) · `GET/POST cles`, `DELETE cles/{id}`.

### Référentiel

`GET referentiels` (zones, contrats, niveaux, métiers et compétences maison +
OPT-NC, villes) · `GET metiers` (84 métiers par famille, avec le nombre d'AVP
ouverts) · `GET metiers/{code}` (compétences attendues, pondérées) ·
`GET competences?q=` (recherche dans les 409).

### Profil et CV (candidat)

| Route | Ce qu'elle fait |
|---|---|
| `GET/PUT profil` | Le profil complet. Les compétences libres sont **rattachées au référentiel OPT** (slug exact, sinon recouvrement de mots) ; `metiersOpt[]` et `competencesOptSaisies[]` s'ajoutent aux champs maison. Tout changement invalide les scores en cache |
| `POST profil/cv` | Journalise une **lecture faite dans l'appareil** : métadonnées + JSON brut + JSON retenu. Le fichier n'est pas dans cet appel |
| `POST profil/cv/fichier` | Dépose le **fichier d'origine** (multipart, champ `fichier`, 10 Mo, PDF/JPEG/PNG/WebP — type lu dans les octets). Chiffré AES-256-GCM sur le serveur, devient le CV actif, suit les candidatures en cours |
| `GET profil/cv`, `GET/PUT/DELETE profil/cv/{id}`, `GET profil/cv/{id}/fichier` | Mes CV, ce que j'ai retenu après relecture, lequel est actif, relire ou supprimer mon fichier |
| `GET profil/cv.pdf` | Le CV **généré depuis le profil** (PDF) |
| `GET profil/jsonresume` | Le profil au format [JSON Resume](https://jsonresume.org) — la première des « API nécessaires » : le CV en résumé JSON |

### Offres et AVP

| Route | Ce qu'elle fait |
|---|---|
| `GET avp` | Le **catalogue public** des AVP : `q` (recherche plein texte), `ville`, `province`, `famille`, `direction`, `contrat`, `zone`, `source`, `encadrement`, `teletravail`, `debutant`, `clos`, `page` |
| `GET avp/filtres` | Les facettes avec leur compte — **les mêmes filtres que la recherche de l'OPT** |
| `GET avp/{id}` | Une offre, son métier OPT, et son score pour le candidat connecté |
| `POST avp/{id}/vue` | Compte une vue (deck, détail, recherche, lien) — une par personne, par offre et par jour |
| `GET avp/{id}/candidats` | Organisation : les candidats classés pour une offre (`vivier=1` pour inclure les profils qui n'ont pas candidaté) |
| `GET/POST offres`, `PUT/DELETE offres/{id}` | Les offres de l'organisation (source `app`). Un AVP synchronisé (source `opt`) se consulte mais ne se modifie pas ici |
| `POST admin/sync/avp`, `GET admin/sync/avp` | Synchronisation depuis le dataset OPT-NC (`X-Sync-Token`) et son état |

### Deck, candidatures, dossier

| Route | Ce qu'elle fait |
|---|---|
| `GET deck` | Les offres non décidées, **scorées et triées**, avec les mêmes filtres que le catalogue ; `clos=1` pour s'entraîner sur les AVP fermés. `409 profil_incomplet` avec `manques[]` tant qu'un score n'est pas calculable |
| `POST swipes` | `oui` **est une candidature** ; `non`, `plus_tard`. Rien n'élimine : un profil peut candidater à n'importe quel poste, les écarts (contrat, zone, télétravail…) baissent le score et sont affichés |
| `DELETE swipes/{offre}` | Revenir sur une décision (retire la candidature si elle n'est pas encore ouverte) |
| `GET interets` | Tout ce que j'ai décidé, avec le score et l'état de candidature |
| `GET/POST candidatures`, `GET candidatures/{id}` | Mes candidatures (candidat) ou celles de l'organisation (`?offre=&statut=`) ; l'ouvrir côté organisation la marque `vue` |
| `PUT candidatures/{id}/statut` | `envoyee → vue → preselection → entretien → acceptee / refusee` ; `retiree` côté candidat. **La présélection ouvre le match, le contact (prénom, nom, e-mail, téléphone) et le dossier** |
| `GET candidatures/{id}/cv.pdf` | Le **CV généré, recentré sur le poste** (compétences du métier OPT en tête) |
| `GET candidatures/{id}/cv-original` | Le **fichier déposé** par le candidat, déchiffré à la volée — organisation : après présélection seulement |
| `GET candidatures/{id}/suggestions` | Trois débuts de message pour chaque côté, par règles (pas de modèle de langage) |

Avant la présélection, une organisation voit un profil **anonyme** : métiers,
compétences, parcours sans nom d'employeur, zones, contrats, disponibilité.
Le masquage est fait côté serveur (`candidatVuParEntreprise`), jamais dans
l'interface.

### Messages et agenda

`GET matchs` · `GET matchs/{id}` · `GET/POST matchs/{id}/messages` ·
`GET matchs/{id}/suggestions` · `GET notifications`, `POST notifications/lu`.

`GET agenda` (mes entretiens, ou ceux de toute l'organisation) ·
`POST candidatures/{id}/entretiens` (1 à 6 créneaux, UTC, durée, mode, lieu) ·
`PUT entretiens/{id}` (candidat : `confirme` — les autres créneaux s'annulent —
ou `refuse` ; organisation : `annule`, `termine`, `confirme`) ·
`GET entretiens/{id}/ics` (iCalendar, pour n'importe quel agenda).

### Tableau de bord (organisation)

`GET organisation/tableau?periode=7|30|90|365`, `GET organisation/tableau/{offre}`,
`GET organisation/tableau.csv` (par offre, pour un tableur ou Power BI).

Treize indicateurs, chacun avec sa définition dans la réponse : vues et
personnes distinctes, candidatures reçues, taux de conversion, à traiter,
présélections, refus, écartées par les candidats, entretiens, délai de prise en
compte, délai de décision, première candidature, score moyen, messages
échangés. Plus les séries par jour, l'entonnoir, la répartition par état, les
répartitions (zones, niveaux, métiers, expérience, provenance des vues), les
compétences qui manquent le plus et les plus présentes (lues dans la
photographie du score prise à la candidature), le classement des offres et
l'activité de l'équipe.

`GET/POST/PUT organisation` · `POST organisation/rejoindre` ·
`GET organisation/membres` · `POST organisation/invitation` ·
`PUT/DELETE organisation/membres/{id}`.

## Le score, en deux mots

Deux regards, **le plus faible des deux, jamais la moyenne** : ce que
l'employeur regarde (compétences, expérience, formation, disponibilité) et ce
que le candidat regarde (métier visé, contrat, salaire, conditions). Les
compétences combinent trois signaux : le **référentiel OPT** pondéré via le
code métier de l'AVP, le **lexique de l'AVP** lui-même, et les compétences
explicites de l'offre. Chaque écart avec les critères du candidat retire 20 %
(plancher 30 %) sans jamais éliminer. La **confiance** — la part des critères
renseignés — est donnée à part. Avec une clé OPT, `POST /avps/search` ajoute
un signal sémantique ; sans, rien ne manque au calcul. Détail dans
`site/matching.php`.

## Erreurs

Toujours `{erreur: <code>, message: <phrase lisible>}` avec le statut HTTP. Le
code est stable, le message peut changer.

| HTTP | Codes |
|---|---|
| 401 | `non_connecte`, `identifiants` |
| 403 | `role_insuffisant`, `compte_inactif`, `interdit`, `origine_refusee`, `dossier_ferme` |
| 404 | `route_inconnue`, `introuvable` |
| 409 | `profil_incomplet` (+ `manques[]`), `email_pris`, `deja_membre`, `organisation_manquante` |
| 413 | `corps_trop_grand`, `fichier_trop_grand` |
| 415 | `format_refuse` |
| 422 | `champ_manquant`, `*_invalide`, `mot_de_passe_court`, `creneaux_invalides` |
| 429 | `trop_de_requetes` (+ `Retry-After`) |
| 500 / 503 | `enregistrement`, `base_indisponible`, `stockage_indisponible`, `chiffrement_absent` |

## Ce que l'API refuse de faire, par conception

- **Masquer côté serveur, jamais côté interface.** Une organisation ne voit
  qu'un profil anonyme avant la présélection ; le nom, l'e-mail, le téléphone
  et le dossier ne quittent pas le serveur avant.
- **Aucune date sur les formations.** L'année d'obtention révèle l'âge, critère
  de discrimination interdit. Le schéma n'a pas la colonne. Pas de photo, pas
  de lieu de résidence non plus.
- **Le score est calculé ici, et nulle part ailleurs.** Un score calculé dans
  le navigateur se modifie dans le navigateur.
- **Rien n'élimine.** Un filtre strict sur le contrat ou la zone cache des
  candidatures valables ; on baisse, on explique, on laisse candidater.
- **Journal d'accès** (`audit_logs`) : qui a consulté quelle donnée personnelle
  et quand. L'adresse IP y est une empreinte salée (`IP_SEL`), pas l'adresse.
- **Aucun e-mail n'est envoyé.** Les codes et notifications vont dans
  `email_queue` ; brancher un fournisseur est une décision, pas un patch.
- **Pas de translittération par `iconv`.** Elle dépend de la bibliothèque C du
  serveur et fragmentait le référentiel en silence. Table explicite.

## Sécurité — ce qui est fait, ce qui reste

Audit du 21 septembre 2026, tout point de l'audit du 14 traité :

- Argon2id + hachage factice à la connexion, **limites de débit** par route
  (`rate_limits` : connexion, inscription, réinitialisation, dépôt, messages,
  synchronisation) et globale (240/min par adresse), **rotation de session** à
  la connexion, empreinte du navigateur vérifiée.
- **Vérification d'origine** sur toute écriture (`Origin` / `Sec-Fetch-Site`),
  liste blanche CORS (`AVP_ORIGINES`, `capacitor://localhost` pour le natif).
- **En-têtes** : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, CSP sur les réponses de l'API, `Cache-Control: no-store`.
  La page de l'application pose les siens elle-même (`beta/dist/index.php`,
  généré à la construction) : sur l'hébergement mutualisé, nginx sert les
  fichiers statiques et ignore le `.htaccess`.
- **Secrets hors du code et hors du docroot** (`private/avp.env`) ; le fichier
  `config.php` de production ne contient aucune valeur.
- **Fichiers de CV chiffrés** (AES-256-GCM, clé dans l'env, IV et tag par
  fichier), stockés hors docroot, type lu dans les octets, 10 Mo, supprimés
  avec le compte.
- Corps JSON borné à 1 Mo ; requêtes préparées partout ; contrôle
  d'appartenance sur chaque identifiant (offre de l'organisation, candidature
  du candidat ou de l'organisation, entretien, match).
- Clés d'API à secret haché (`sha256`), préfixe visible, révocables.
- Consentement versionné, export et effacement.

Reste, par ordre d'importance :

1. **Envoi d'e-mails** (vérification, réinitialisation, notifications) —
   file prête, fournisseur à choisir.
2. **Deux utilisateurs MySQL** (lecture-écriture pour l'app, DDL pour les
   migrations) — un seul aujourd'hui.
3. **Clé OPT-NC** absente : le signal sémantique de `/avps/search` et le
   dataset temps réel ne sont pas branchés ; le dataset public suffit à la
   démonstration.
4. **Rate limiting par compte** en plus de l'adresse (un NAT d'entreprise
   partage une adresse).
5. **Journal applicatif centralisé** (aujourd'hui `error_log` du vhost).

## Pièges rencontrés

- **`Authorization` n'atteint pas PHP** : Apache retire l'en-tête. Sans
  `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` dans `.htaccess`, tout
  client `Bearer` est « non connecté », sans erreur. `CGIPassAuth On`, la
  directive officielle, provoque un 500 sur l'hébergement mutualisé utilisé.
- **Un `POST` sans corps est refusé par ModSecurity** (403 HTML, pas JSON) :
  toujours envoyer `-d '{}'` avec `Content-Type: application/json`.
- **L'ordre des `require` compte** : chaque fichier de domaine exécute ses
  routes au chargement. Une fonction définie dans un fichier chargé après est
  un fatal 500 (`cvActif()` a vécu au mauvais endroit).
- **La garde du corps JSON ne doit pas voir un multipart** : PHP a déjà
  découpé le fichier dans `$_FILES`, `php://input` est vide, et le
  `Content-Length` dépasse 1 Mo.
- **`.mjs` servi en `text/plain`** : le worker de pdf.js est refusé par le
  navigateur. `AddType text/javascript .mjs` côté application.
- **`iconv('//TRANSLIT')`** : « Développement web » devenait `d-veloppement-web`
  sur le serveur. Voir plus haut.

## Recette

```bash
python ../scripts/essai_api.py                                   # en local, sans serveur (CLI)
AVP_API=https://…/api/index.php python ../scripts/essai_api.py   # contre un déploiement
```

Quatre-vingt-dix appels qui rejouent le parcours complet des deux côtés :
inscription (candidat, deux RH d'une même organisation), profil et rattachement
OPT, deck verrouillé puis ouvert, filtres et recherche, candidature, lecture
anonyme puis présélection, dossier (CV généré, fichier d'origine déposé en
multipart), entretiens et confirmation, messages et suggestions, tableau de
bord, clés d'API, garde-fous (403 d'une autre organisation, dossier fermé
avant présélection), export, effacement. Les comptes créés sont préfixés `zz_`
et supprimés **par leur propre session** à la fin. Jamais de `DELETE` sans
`WHERE` sur une base partagée.
