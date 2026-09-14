# API — Adopte un Job

PHP 8, MySQL 8, **un seul point d'entrée** : `index.php`. Pas de framework, pas de
dépendance : cinq fichiers, un schéma, un `.htaccess`.

| Fichier | Rôle |
|---|---|
| `index.php` | Le routeur et toutes les routes |
| `noyau.php` | Réponses JSON, lecture des entrées, sessions, journal d'accès, notifications |
| `depot.php` | Accès aux données : profil complet, offre garnie, masquage avant match |
| `score.php` | Le moteur de score, version `ALGO` écrite dans `match_scores` |
| `config.php` | **À créer** depuis `config.example.php`. Jamais versionné. |
| `schema.sql` | 29 tables, `CREATE TABLE IF NOT EXISTS` — rejouable |
| `.htaccess` | Fait passer l'en-tête `Authorization` à PHP (voir *Pièges*) |

## Installation

```bash
cp config.example.php config.php        # hôte, base, utilisateur, mot de passe, IP_SEL
php -r 'echo bin2hex(random_bytes(16));' # → IP_SEL : 32 caractères propres à cette installation
AVP_DB_HOST=… AVP_DB_USER=… AVP_DB_PASS=… AVP_DB_NAME=… python ../scripts/migre.py
```

`migre.py` applique le schéma puis les référentiels (métiers, compétences, alias).
Il est idempotent. Pour vérifier l'installation : `GET /index.php` répond avec
la version et la liste des routes ; `GET /index.php/referentiels` avec les listes.

## Appeler l'API

Deux formes d'URL, équivalentes :

```
https://…/api/index.php/profil          (PATH_INFO)
https://…/api/index.php?r=profil        (paramètre r, si le serveur ne passe pas PATH_INFO)
```

Corps des requêtes en **JSON** (`Content-Type: application/json`). Réponses en
JSON UTF-8, `Cache-Control: no-store`. Les identifiants numériques sont des
entiers ; les dates en `YYYY-MM-DD HH:MM:SS` **UTC**.

### Authentification

Un jeton opaque de 64 caractères hexadécimaux, créé à l'inscription ou à la
connexion, valable 30 jours (`SESSION_J`). Il est accepté de deux façons — les
deux, jamais l'une seulement, parce que l'application native n'aura pas de cookie :

| Client | Transport |
|---|---|
| Navigateur | Cookie `avp_sid` — `HttpOnly`, `Secure`, `SameSite=Lax`, posé par l'API |
| Natif, script | En-tête `Authorization: Bearer <jeton>` |

Les mots de passe sont hachés en **Argon2id**, 12 caractères minimum, sans règle
de composition. La connexion répond la même chose, dans le même temps, que le
compte existe ou non.

### Rôles

`candidat` (par défaut), `recruteur`, `admin`. Une route qui exige un rôle
répond `403 role_insuffisant` sinon. L'admin passe partout.

## Les routes

### Compte

| Méthode | Route | Corps / réponse |
|---|---|---|
| `POST` | `auth/inscription` | `{email, motdepasse, role?}` → `201 {jeton, utilisateur}`. Consentement `traitement_candidature` tracé avec sa version |
| `POST` | `auth/connexion` | `{email, motdepasse}` → `{jeton, utilisateur}` |
| `POST` | `auth/deconnexion` | Détruit la session courante |
| `GET` | `auth/moi` | `{utilisateur}` ou `{utilisateur: null}` — ne renvoie jamais 401 |
| `GET` | `auth/export` | **Portabilité** : tout ce que la base sait du compte, en JSON |
| `DELETE` | `auth/compte` | **Effacement** : anonymisation (l'e-mail devient irréversible, les tables liées sont purgées, le journal garde l'événement) |

### Référentiels et profil (candidat)

| Méthode | Route | Corps / réponse |
|---|---|---|
| `GET` | `referentiels` | Zones, contrats, métiers, compétences, langues, niveaux |
| `GET` | `profil` | Le profil complet |
| `PUT` | `profil` | Tout ou partie : `prenom, initiale, nom, telephone, dispo, zones[], contrats[], metiers[], competences[], langues[], experiences[], formations[], formation, experienceAns, permis, teletravail, salaireMin, ouverture, mode, …`. Une compétence inconnue est créée (trois passes : slug → alias → création). Le changement invalide les scores en cache |
| `POST` | `profil/cv` | `{nom, mime, octets, sha256, moteur, version, brut, retenu}` → `201 {cv}`. **Le fichier n'est pas envoyé** : seulement ses métadonnées et le JSON lu dans l'appareil |

### Deck et décisions (candidat)

| Méthode | Route | Corps / réponse |
|---|---|---|
| `GET` | `deck` | Les offres ouvertes non encore décidées, avec leur score, triées par qualité — **`409 profil_incomplet`** avec la liste `manques[]` tant que le profil ne permet pas un score |
| `GET` | `deck/{offre}` | Une offre et le détail complet de son score (« ce qui colle », « à vérifier ») |
| `POST` | `swipes` | `{offre, decision}` — `oui`, `non`, `plus_tard` → `{ok, match}` |
| `DELETE` | `swipes/{offre}` | Revenir sur une décision : la carte revient dans le deck |
| `GET` | `interets` | Tout ce qui a été décidé, avec les scores (recalculés s'ils manquent) |
| `GET` | `notifications` · `POST notifications/lu` | En base, pas encore poussées |

### Gelé — côté recruteur

`GET/PUT entreprise`, `GET/POST/PUT/DELETE offres`, `GET matchs`,
`matchs/{id}`, `matchs/{id}/messages`, `matchs/{id}/rdv`, `POST rdv/{id}`.

Le code existe et fonctionne (recette 28/28), mais **le brief du HackAVP est
explicite : le jury joue l'employeur, il n'y a pas de second « oui » à obtenir.**
Ces routes ne reçoivent ni sécurité ni tests supplémentaires, et sont à retirer
du routeur avant une mise en production. Un endpoint exposé et inutilisé est une
surface d'attaque gratuite.

## Erreurs

Toujours `{erreur: <code>, message: <phrase lisible>}` avec le statut HTTP. Le
code est stable, le message peut changer.

| HTTP | Codes |
|---|---|
| 401 | `non_connecte`, `identifiants` |
| 403 | `role_insuffisant`, `compte_inactif`, `interdit` |
| 404 | `route_inconnue`, `introuvable` |
| 409 | `profil_incomplet` (+ `manques[]`), `email_pris`, `match_existant`, `entreprise_manquante` |
| 422 | `champ_manquant`, `email_invalide`, `mot_de_passe_court`, `date_invalide`, `statut_invalide`, `message_vide` |
| 500 / 503 | `enregistrement`, `base_indisponible` |

## Ce que l'API refuse de faire, par conception

- **Masquer côté serveur, jamais côté interface.** Une entreprise ne voit
  qu'un profil anonyme avant le match ; le nom, le téléphone et l'e-mail ne
  quittent pas le serveur tant qu'il n'y a pas deux oui. Masquer dans le front
  serait une faille, pas une règle.
- **Aucune date sur les formations.** L'année d'obtention révèle l'âge, critère
  de discrimination interdit. Le schéma n'a pas la colonne.
- **Le score est calculé ici, et nulle part ailleurs.** Un score calculé dans le
  navigateur se modifie dans le navigateur. Deux scores directionnels, la
  qualité est le minimum, la confiance est à part.
- **Journal d'accès** (`audit_logs`) : qui a consulté quelle donnée personnelle
  et quand. L'adresse IP y est une empreinte salée (`IP_SEL`), pas l'adresse.
- **Pas de translittération par `iconv`.** Elle dépend de la bibliothèque C du
  serveur et fragmentait le référentiel en silence. Table explicite.

## Sécurité — ce qui est fait, ce qui reste

Audit du 14 septembre 2026. Fait : Argon2id, sessions opaques, cookie
`HttpOnly`/`Secure`/`SameSite`, réponse constante à la connexion, contrôle
d'appartenance sur chaque identifiant, requêtes préparées partout, consentement
versionné, export et effacement.

Reste, par ordre d'importance :

1. **Limite de débit** — aucune. Connexion (force brute), et surtout la future
   génération de documents (coût par appel). Préalable au chantier ③.
2. **Vérification d'origine** — `Origin` / `Sec-Fetch-Site` sur toute écriture ;
   liste blanche CORS pour l'application native (`capacitor://localhost`).
3. **Secrets hors du code** — `.env` hors docroot ; deux utilisateurs MySQL
   (lecture-écriture pour l'app, DDL pour les migrations).
4. **Rotation de session** à la connexion ; comparer `ua_hash`, stocké mais
   jamais lu.
5. **Réinitialisation de mot de passe** et vérification d'e-mail — dépendent
   d'un envoi de mail (Brevo), le même canal que la fonction ④.
6. Corps de requête borné (`post_max_size`), en-têtes `X-Content-Type-Options`,
   `Referrer-Policy`, CSP.
7. `resume_extractions.accepted` toujours vide : le choix de l'utilisateur après
   relecture n'est jamais renvoyé. Un `PUT profil/cv/{id}` à la validation.

## Pièges rencontrés

- **`Authorization` n'atteint pas PHP** : Apache retire l'en-tête. Sans
  `SetEnvIf Authorization "(.*)" HTTP_AUTHORIZATION=$1` dans `.htaccess`, tout
  client `Bearer` est « non connecté », sans erreur. `CGIPassAuth On`, la
  directive officielle, provoque un 500 sur l'hébergement mutualisé utilisé.
- **`.mjs` servi en `text/plain`** : le worker de pdf.js est refusé par le
  navigateur. `AddType text/javascript .mjs` côté application.
- **`iconv('//TRANSLIT')`** : « Développement web » devenait `d-veloppement-web`
  sur le serveur. Voir plus haut.

## Recette

```bash
AVP_API=https://…/api/index.php python ../scripts/essai_api.py
```

Vingt-huit appels qui rejouent le parcours complet — inscription, profil, deck
verrouillé puis ouvert, décisions, retour en arrière, export, effacement — et
comparent chaque réponse à l'attendu. Les comptes créés sont préfixés `zz_` et
supprimés **par leur identifiant** à la fin. Jamais de `DELETE` sans `WHERE`
sur une base partagée.
