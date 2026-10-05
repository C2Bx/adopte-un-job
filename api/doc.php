<?php
/**
 * Adopte un Job — la description de l'API (OpenAPI 3.1), generee depuis une
 * table de routes tenue a la main. Une route qui n'est pas ici n'existe pas
 * pour un integrateur ; une route ici qui n'existe pas est un bug de doc —
 * la recette (scripts/essai_api.py) verifie que les deux listes coincident.
 */

declare(strict_types=1);

/** [methode, chemin, resume, tag, auth (public|session|candidat|admin|sync), corps?, reponse?] */
function routesDocumentees(): array
{
    return [
        ['GET', '', 'Version, algorithme, liste des routes', 'meta', 'public'],
        ['GET', 'openapi.json', 'Ce document', 'meta', 'public'],

        ['POST', 'auth/inscription', 'Créer un compte — relayé vers POST /auth/register de l’API de l’équipe, qui exige prénom et nom', 'compte', 'public',
            ['email' => 'string', 'motdepasse' => 'string ≥ 12', 'prenom' => 'string', 'nom' => 'string'], ['jeton', 'utilisateur']],
        ['POST', 'auth/equipe', 'Reprendre la synchronisation avec l’API de l’équipe (leur jeton dure 1 h) : le mot de passe courant est revérifié chez eux', 'compte', 'candidat', ['motdepasse' => 'string'], ['ok', 'equipeConnecte']],
        ['POST', 'auth/connexion', 'Ouvrir une session (cookie + jeton) — les identifiants sont vérifiés par POST /auth/login de l’API de l’équipe', 'compte', 'public', ['email' => 'string', 'motdepasse' => 'string'], ['jeton', 'utilisateur']],
        ['POST', 'auth/deconnexion', 'Fermer la session courante', 'compte', 'session'],
        ['GET', 'auth/moi', 'Le compte connecté', 'compte', 'public'],
        ['PUT', 'auth/motdepasse', 'Changer son mot de passe — relayé vers le service de comptes de l’équipe ; 501 tant qu’il ne l’expose pas', 'compte', 'session', ['ancien' => 'string', 'nouveau' => 'string ≥ 12']],
        ['PUT', 'auth/email', 'Changer son adresse — même relais ; l’adresse locale ne bouge qu’après la leur', 'compte', 'session', ['email' => 'string', 'motdepasse' => 'string']],
        ['POST', 'auth/oubli', 'Demander un code de réinitialisation (même réponse que l’adresse existe ou non)', 'compte', 'public', ['email' => 'string']],
        ['POST', 'auth/oubli/confirme', 'Choisir un nouveau mot de passe avec le code reçu', 'compte', 'public', ['code' => 'string', 'motdepasse' => 'string ≥ 12']],
        ['GET', 'auth/sessions', 'Les sessions ouvertes', 'compte', 'session'],
        ['DELETE', 'auth/sessions', 'Fermer toutes les autres sessions', 'compte', 'session'],
        ['GET', 'auth/export', 'Portabilité : toutes les données du compte', 'compte', 'session'],
        ['DELETE', 'auth/compte', 'Effacement : anonymisation, fichiers supprimés, candidatures retirées', 'compte', 'session'],
        ['GET', 'cles', 'Mes clés d’API', 'compte', 'session'],
        ['POST', 'cles', 'Créer une clé d’API (le secret n’est montré qu’une fois)', 'compte', 'session', ['nom' => 'string']],
        ['DELETE', 'cles/{id}', 'Révoquer une clé', 'compte', 'session'],

        ['GET', 'referentiels', 'Zones, contrats, niveaux, métiers et compétences (maison + OPT-NC), villes', 'referentiel', 'public'],
        ['GET', 'metiers', 'Les 84 métiers du référentiel OPT-NC, par famille, avec le nombre d’AVP ouverts', 'referentiel', 'public'],
        ['GET', 'metiers/{code}', 'Un métier et ses compétences attendues, pondérées', 'referentiel', 'public'],
        ['GET', 'competences?q=', 'Recherche dans les 409 compétences OPT-NC', 'referentiel', 'public'],

        ['GET', 'profil', 'Le profil complet (propriétaire seulement)', 'profil', 'candidat'],
        ['PUT', 'profil', 'Enregistrer le profil ; les compétences libres sont rattachées au référentiel OPT', 'profil', 'candidat',
            ['prenom', 'initiale', 'nom', 'telephone', 'dispo', 'zones[]', 'contrats[]', 'metiers[]', 'metiersOpt[] (OPxxx)', 'competences[]', 'competencesOptSaisies[] (COMPn)', 'langues[]', 'experiences[]', 'formations[]', 'formation', 'experienceAns', 'permis', 'teletravail', 'salaireMin', 'ouverture'], ['profil']],
        ['GET', 'profil/jsonresume', 'Le profil au format JSON Resume', 'profil', 'candidat'],
        ['GET', 'profil/cv.pdf', 'Le CV généré depuis le profil (PDF)', 'profil', 'candidat'],
        ['GET', 'profil/cv', 'Mes CV et le résumé JSON lu pour chacun', 'cv', 'candidat'],
        ['POST', 'profil/cv', 'Journaliser une lecture de CV faite dans l’appareil (métadonnées + JSON)', 'cv', 'candidat',
            ['nom', 'mime', 'octets', 'sha256', 'moteur', 'version', 'brut', 'retenu'], ['cv']],
        ['GET', 'profil/cv/{id}', 'Un CV et sa dernière lecture', 'cv', 'candidat'],
        ['PUT', 'profil/cv/{id}', 'Ce que l’utilisateur a gardé après relecture ; « actif » pour le désigner', 'cv', 'candidat', ['retenu' => 'objet', 'actif' => 'bool?']],
        ['DELETE', 'profil/cv/{id}', 'Supprimer mon CV : fichier, lecture et copie de l’espace d’échange, effacés sur-le-champ', 'cv', 'candidat'],
        ['POST', 'profil/cv/fichier', 'Déposer mon CV (multipart, champ « fichier », 10 Mo ; PDF, Word, ODT, RTF, texte, images) — chiffré au repos ; un seul CV : remplace et efface le précédent', 'cv', 'candidat'],
        ['GET', 'profil/cv/{id}/fichier', 'Relire son propre fichier', 'cv', 'candidat'],

        ['GET', 'avp', 'Catalogue des AVP (public), filtres et facettes, page de 30', 'avp', 'public',
            null, null, ['q', 'ville', 'province', 'famille', 'direction', 'contrat', 'zone', 'metier', 'teletravail=1', 'encadrement=1', 'debutant=1', 'salaire=1', 'source', 'statut=ouvert|clos|tous', 'page']],
        ['GET', 'avp/filtres', 'Les valeurs de filtres disponibles avec leur compte', 'avp', 'public'],
        ['GET', 'avp/{id}', 'Une offre, son score pour le candidat connecté, le métier OPT associé', 'avp', 'public'],
        ['POST', 'avp/{id}/vue', 'Compter une vue (deck, detail, recherche, lien)', 'avp', 'public', ['source' => 'string']],
        ['GET', 'deck', 'Les offres non décidées, scorées et triées ; mêmes filtres que le catalogue ; clos=1 pour s’entraîner', 'deck', 'candidat'],
        ['POST', 'swipes', 'Décider : oui (= candidature), non, plus_tard', 'deck', 'candidat', ['offre' => 'int', 'decision' => 'oui|non|plus_tard', 'message' => 'string?']],
        ['DELETE', 'swipes/{offre}', 'Revenir sur une décision (retire la candidature si elle n’est pas encore ouverte)', 'deck', 'candidat'],
        ['GET', 'interets', 'Tout ce que j’ai décidé, avec score et état de candidature', 'deck', 'candidat'],
        ['POST', 'admin/sync/avp', 'Synchroniser les AVP depuis le dataset OPT-NC (X-Sync-Token)', 'avp', 'sync'],
        ['GET', 'admin/sync/avp', 'État de la synchronisation', 'avp', 'public'],

        ['POST', 'candidatures', 'Candidater à une offre', 'candidatures', 'candidat', ['offre' => 'int', 'message' => 'string?'], ['candidature']],
        ['GET', 'candidatures', 'Mes candidatures (?statut=)', 'candidatures', 'candidat'],
        ['GET', 'candidatures/{id}', 'Une candidature et ses événements', 'candidatures', 'candidat'],
        ['PUT', 'candidatures/{id}/statut', 'Retirer sa candidature (statut = retiree)', 'candidatures', 'candidat', ['statut' => 'retiree', 'motif' => 'string?']],
        ['GET', 'candidatures/{id}/cv.pdf', 'Le CV généré, recentré sur le poste', 'candidatures', 'candidat'],
        ['GET', 'candidatures/{id}/cv-original', 'Le fichier déposé', 'candidatures', 'candidat'],

        ['GET', 'notifications', 'Les 50 dernières notifications', 'notifications', 'session'],
        ['POST', 'notifications/lu', 'Tout marquer lu', 'notifications', 'session'],
    ];
}

function openapi(): array
{
    $paths = [];
    foreach (routesDocumentees() as $r) {
        [$m, $chemin, $resume, $tag, $auth] = $r;
        $corps = $r[5] ?? null;
        $reponse = $r[6] ?? null;
        $query = $r[7] ?? null;
        $chemin = '/' . preg_replace('/\?.*$/', '', $chemin);
        $op = [
            'summary' => $resume,
            'tags' => [$tag],
            'security' => $auth === 'public' ? [] : ($auth === 'sync' ? [['syncToken' => []]] : [['cookie' => []], ['bearer' => []], ['cleApi' => []]]),
            'x-role' => $auth,
            'responses' => [
                '200' => ['description' => 'OK' . ($reponse ? ' — ' . implode(', ', $reponse) : '')],
                '401' => ['description' => 'non_connecte'],
                '403' => ['description' => 'role_insuffisant, interdit, origine_refusee'],
                '404' => ['description' => 'introuvable'],
                '409' => ['description' => 'profil_incomplet, deja_membre, offre_close…'],
                '422' => ['description' => 'champ_manquant, *_invalide'],
                '429' => ['description' => 'trop_de_requetes (Retry-After)'],
            ],
        ];
        $params = [];
        if (preg_match_all('/\{(\w+)\}/', $chemin, $mm)) {
            foreach ($mm[1] as $n) {
                $params[] = ['name' => $n, 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']];
            }
        }
        foreach ((array) $query as $q) {
            [$n, $ex] = array_pad(explode('=', $q, 2), 2, null);
            $params[] = ['name' => $n, 'in' => 'query', 'schema' => ['type' => 'string'], 'example' => $ex];
        }
        if ($params) {
            $op['parameters'] = $params;
        }
        if ($corps) {
            $props = [];
            foreach ($corps as $k => $v) {
                if (is_int($k)) {
                    $props[preg_replace('/[^\w]/', '', explode(' ', $v)[0])] = ['description' => $v];
                } else {
                    $props[$k] = ['description' => (string) $v];
                }
            }
            $op['requestBody'] = ['content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => $props]]]];
        }
        $paths[$chemin][strtolower($m)] = $op;
    }
    return [
        'openapi' => '3.1.0',
        'info' => [
            'title' => 'Adopte un Job — API', 'version' => '2.0',
            'description' => 'REST, JSON, un point d’entrée. Chemins relatifs à /avp/app/api/index.php (PATH_INFO) ou ?r=. Toutes les dates sont en UTC. Les erreurs rendent {erreur, message} avec le statut HTTP.',
        ],
        'servers' => [['url' => 'https://zako.nc/avp/app/api/index.php']],
        'components' => ['securitySchemes' => [
            'cookie' => ['type' => 'apiKey', 'in' => 'cookie', 'name' => COOKIE],
            'bearer' => ['type' => 'http', 'scheme' => 'bearer', 'description' => 'Jeton de session (64 hex) ou clé d’API aj_…'],
            'cleApi' => ['type' => 'http', 'scheme' => 'bearer', 'description' => 'Clé d’API tierce : aj_<prefixe>.<secret>'],
            'syncToken' => ['type' => 'apiKey', 'in' => 'header', 'name' => 'X-Sync-Token'],
        ]],
        'paths' => $paths,
    ];
}
