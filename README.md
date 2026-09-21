# Adopte un Job

Un poste qui te correspond, pas trente CV envoyés. Application de mise en
relation **candidat ↔ AVP réels de l'OPT-NC** en mode « swipe », avec un **score
de compatibilité explicable**, une **lecture de CV dans l'appareil** (PDF, scan
ou photo), et, de l'autre côté, un **espace organisation** : plusieurs comptes RH
sur les mêmes offres, candidatures anonymes jusqu'à la présélection, dossier
(CV recentré + CV d'origine), entretiens, tableau de bord.

Projet d'étudiants, candidat au **#HackAVP** (OPT-NC · Station N · OPEN NC),
premier hackathon dédié à l'emploi dans la fonction publique en Nouvelle-Calédonie.

## Ce que ça fait

**Candidat.** Un profil structuré (ce qu'on vise, pas seulement ce qu'on a
fait), rempli à la main ou amorcé depuis un CV lu dans le navigateur. Les
compétences libres sont rattachées aux **409 compétences du référentiel
OPT-NC**, le métier visé à l'un de ses **84 métiers**. Le deck propose les AVP
ouverts, scorés et triés, avec les **mêmes filtres que la recherche officielle**
(ville, province, famille, direction, contrat, encadrement, télétravail…) et une
barre de recherche. **Rien n'élimine** : n'importe quel profil peut candidater à
n'importe quel poste, les écarts baissent le score et sont dits. Un « oui » est
une candidature ; on suit son état, on discute après la présélection, on
confirme un créneau d'entretien dans l'agenda, on exporte en `.ics`.

**Organisation.** Un compte RH rejoint son organisation par un code
d'invitation (ou la crée). Les offres sont les **AVP synchronisés depuis le
dataset officiel** de l'OPT-NC (`opt-nc/odata-avps`) ; on peut aussi en
publier. Les candidatures arrivent **anonymes**, classées par compatibilité,
avec le détail du score ; la présélection ouvre le contact et le dossier :
**CV recentré sur le poste** (généré) et **CV d'origine** (déposé chiffré). Des
propositions de premiers messages, pour les deux côtés, par règles. Un
**tableau de bord par organisation** : 13 indicateurs définis, séries par
jour, entonnoir, répartitions, compétences manquantes, classement des offres,
activité de l'équipe, export CSV.

**API REST.** Tout ce qui précède est une API documentée en OpenAPI 3.1
(`GET /openapi.json`), avec des clés d'API pour les intégrations. La première
route « utilitaire » : le **CV en résumé JSON** (`GET profil/jsonresume`,
format JSON Resume).

## Ce qu'il y a dans ce dépôt

| Dossier | Contenu |
|---|---|
| `beta/` | L'application : React 19 + TypeScript strict, Vite. Sortie 100 % statique, empaquetable pour les magasins (Capacitor). Deux jeux d'écrans selon le rôle. |
| `api/` | L'API : PHP 8, MySQL 8, un point d'entrée `index.php`, un fichier par domaine. Routes, sécurité, pièges : [`api/README.md`](api/README.md). |
| `prototype/` | Le prototype d'origine (PHP + JS, `localStorage`), référence de mise en forme et mode démonstration sans compte. |
| `site/` | Le site de documentation du projet : produit, matching, extraction, arbitrages, API, techno… |
| `scripts/` | Migration du schéma (`migre.py`, avec le référentiel OPT-NC), recette de l'API (`essai_api.py`, 90 appels, CLI ou HTTPS), **banc d'essai de la lecture de CV** sur un corpus. |

## Lecture de CV : PDF, scan, photo

Le CV est lu par le navigateur ; ce qui est envoyé, c'est le résultat relu,
puis — si l'utilisateur le veut — le fichier lui-même, chiffré côté serveur
(AES-256-GCM) et remis uniquement à l'organisation qui présélectionne.

- **PDF avec texte** → pdf.js donne des fragments positionnés ; on reconstruit
  la mise en page (colonnes, bandeau d'identité par taille de police), puis des
  règles suivent les rubriques (expérience, formation…). Aucun modèle de
  langage : ce qui n'est pas trouvé reste vide, et tout est relu champ par
  champ avant d'entrer dans le profil.
- **Image ou PDF scanné** → Tesseract (WebAssembly) produit les mêmes fragments,
  avec une confiance. Le moteur, son cœur et le modèle français sont servis par
  l'application (`npm run ocr` les met en place), pas par un CDN. En dessous de
  70 % de confiance, rien n'est coché d'office.

Détails et règles issues du corpus : `site/extraction.php`.

## Démarrer

### API

```bash
cp api/config.example.php api/config.php
# secrets dans private/avp.env (hors docroot) ou api/.env — liste dans api/README.md
AVP_DB_HOST=… AVP_DB_USER=… AVP_DB_PASS=… AVP_DB_NAME=… python scripts/migre.py   # schéma, migrations, référentiels, OPT-NC
curl -X POST -H "X-Sync-Token: …" -H "Content-Type: application/json" -d '{}' https://…/api/index.php?r=admin/sync/avp
```

`api/config.php` et les `.env` sont ignorés par git. Une tâche planifiée
rejoue la synchronisation (les AVP expirés se ferment, les nouveaux arrivent).
Sans clé OPT-NC, les AVP viennent du dataset public ; avec, l'API officielle
ajoute un signal sémantique au score.

### Application

```bash
cd beta
npm install        # installe aussi les fichiers OCR dans public/ocr (postinstall)
npm run dev        # http://localhost:5173/avp/beta/ — l'API est proxifiée (voir vite.config.ts)
npm run build      # dist/ à déposer sous /avp/beta/ du site
```

### Recette

```bash
python scripts/essai_api.py                                     # en local, sans serveur web
AVP_API=https://…/api/index.php python scripts/essai_api.py     # contre un déploiement
python scripts/essai_cv.py mon_cv.pdf                           # la lecture d'un CV, champ par champ
AVP_CV_DIR=cv python scripts/audit_corpus.py                    # tout un dossier (les CV ne sont pas dans le dépôt)
```

## Données personnelles

- Aucune photo, aucun lieu de résidence, **aucune date sur les formations**
  (l'année d'obtention révèle l'âge). Le schéma n'a pas les colonnes.
- Une organisation ne voit qu'un profil anonyme avant de présélectionner ; le
  masquage est fait par le serveur, pas par l'interface.
- Le fichier de CV est chiffré, stocké hors du docroot, supprimé avec le compte.
- Consentement versionné à l'inscription, export complet et suppression
  (anonymisation), journal des accès aux données.
- Aucun e-mail n'est envoyé aujourd'hui : les codes de vérification et de
  réinitialisation sont mis en file, l'envoi est un choix à faire.
- Pour tester : profils fictifs, ou le vôtre. Pas le CV d'un tiers sans son accord.

## Licence

À définir par l'équipe.
