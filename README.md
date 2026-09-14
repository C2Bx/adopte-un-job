# Adopte un Job

Un poste qui te correspond, pas trente CV envoyés. Application de mise en relation
candidat ↔ offre en mode « swipe », avec un **score de compatibilité explicable**
et une **lecture de CV entièrement dans l'appareil** (PDF, scan ou photo — rien ne
part sur le réseau).

Projet d'étudiants, candidat au **#HackAVP** (OPT-NC · Station N · OPEN NC),
premier hackathon dédié à l'emploi dans la fonction publique en Nouvelle-Calédonie.

## Ce qu'il y a dans ce dépôt

| Dossier | Contenu |
|---|---|
| `beta/` | L'application : React 19 + TypeScript strict, Vite. Sortie 100 % statique, empaquetable pour les magasins (Capacitor). |
| `api/` | L'API : PHP 8, MySQL 8, un seul point d'entrée `index.php`. Sessions par jeton opaque, mots de passe Argon2id, journal d'accès, export et suppression de compte. |
| `prototype/` | Le prototype d'origine (PHP + JS, `localStorage`), référence de mise en forme et mode démonstration sans compte. |
| `site/` | Le site de documentation du projet : produit, matching, extraction, arbitrages, techno… |
| `scripts/` | Migration du schéma, amorçage, recette de l'API (28 appels), **banc d'essai de la lecture de CV** sur un corpus. |

## Lecture de CV : PDF, scan, photo

Le CV est lu par le navigateur, jamais envoyé :

- **PDF avec texte** → pdf.js donne des fragments positionnés ; on reconstruit la
  mise en page (colonnes, bandeau d'identité par taille de police), puis des règles
  suivent les rubriques (expérience, formation…). Aucun modèle de langage : ce qui
  n'est pas trouvé reste vide, et tout est relu champ par champ avant d'entrer
  dans le profil.
- **Image ou PDF scanné** → Tesseract (WebAssembly) produit les mêmes fragments,
  avec une confiance. Le moteur, son cœur et le modèle français sont servis par
  l'application (`npm run ocr` les met en place), pas par un CDN. Les bandeaux de
  titre en blanc sur couleur sont relus inversés ; le nom en très gros est relu à
  échelle réduite. En dessous de 70 % de confiance, rien n'est coché d'office.

Détails et règles issues du corpus : `site/extraction.php`.

## Démarrer

### API

```bash
cp api/config.example.php api/config.php     # puis remplir hôte, base, utilisateur, mot de passe, IP_SEL
AVP_DB_HOST=… AVP_DB_USER=… AVP_DB_PASS=… AVP_DB_NAME=… python scripts/migre.py   # schéma + référentiels
```

`api/config.php` est ignoré par git et ne doit jamais être versionné. Le
`.htaccess` fait passer l'en-tête `Authorization` à PHP (nécessaire aux clients
natifs qui n'ont pas de cookie).

### Application

```bash
cd beta
npm install        # installe aussi les fichiers OCR dans public/ocr (postinstall)
npm run dev        # http://localhost:5173/avp/beta/ — l'API est proxifiée (voir vite.config.ts)
npm run build      # dist/ à déposer sous /avp/beta/ du site
```

### Banc d'essai de la lecture de CV

```bash
python scripts/essai_cv.py mon_cv.pdf              # un CV, champ par champ, avec la source de chaque valeur
AVP_CV_DIR=cv python scripts/audit_corpus.py       # tout un dossier (les CV ne sont pas dans le dépôt)
```

Le banc rejoue le fichier **réellement servi** (`prototype/assets/extraction.js`)
sur chaque document : c'est lui qui attrape les régressions.

## Données personnelles

- Le CV ne quitte pas l'appareil ; seul le résultat de la lecture (JSON) est
  envoyé, après relecture.
- Aucune date sur les formations : l'année d'obtention révèle l'âge.
- Consentement versionné à l'inscription, export complet et suppression
  (anonymisation) disponibles dès maintenant, journal des accès aux données.
- Pour tester : profils fictifs, ou le vôtre. Pas le CV d'un tiers sans son accord.

## Licence

À définir par l'équipe.
