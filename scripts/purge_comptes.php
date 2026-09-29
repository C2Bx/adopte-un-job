<?php
/**
 * Anonymise des comptes, un par un, par leur identifiant.
 *
 *   php purge_comptes.php 7 32 46              montre ce qui serait fait
 *   php purge_comptes.php 7 32 46 --confirmer  le fait
 *
 * Pourquoi ce script existe : la recette (`essai_api.py`) supprime le compte
 * qu'elle cree, mais une execution interrompue en laisse un derriere elle.
 * Ces comptes restent actifs, partent dans la passerelle d'echange comme s'il
 * s'agissait de vraies personnes, et faussent tout comptage.
 *
 * Pourquoi il ANONYMISE au lieu de supprimer : c'est exactement ce que fait
 * `DELETE auth/compte`, la route que l'utilisateur declenche lui-meme. Un
 * `DELETE FROM users` casserait les cles etrangeres des candidatures et des
 * scores, et laisserait les fichiers chiffres sur le disque. Ici les donnees
 * personnelles disparaissent, la ligne reste.
 *
 * Trois garde-fous :
 *   - les identifiants sont donnes a la main, jamais devines par un motif :
 *     un compte reel prefixe `zz_` par hasard ne doit pas y passer ;
 *   - sans `--confirmer`, RIEN n'est ecrit ;
 *   - chaque compte est montre — adresse, prenom, candidatures, fichiers —
 *     avant d'etre touche, et l'ecriture se fait dans une transaction par
 *     compte : une erreur au milieu n'en laisse aucun a moitie efface.
 */

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$_SERVER['REQUEST_METHOD'] = 'CLI';
$_SERVER['REMOTE_ADDR'] = '127.0.0.1';
$_SERVER['HTTP_USER_AGENT'] = 'purge_comptes';

$racine = is_file(__DIR__ . '/noyau.php') ? __DIR__ : __DIR__ . '/../api';
require $racine . '/noyau.php';

$args = array_slice($argv, 1);
$confirme = in_array('--confirmer', $args, true);
$ids = array_values(array_unique(array_map('intval', array_filter($args, 'ctype_digit'))));

if (!$ids) {
    fwrite(STDERR, "Usage : php purge_comptes.php <id> [<id>...] [--confirmer]\n");
    exit(2);
}

$pdo = db();
$aTraiter = [];

echo str_repeat('=', 78), "\n";
echo $confirme ? "  ANONYMISATION — les donnees vont etre effacees\n"
               : "  SIMULATION — rien ne sera ecrit (ajouter --confirmer)\n";
echo str_repeat('=', 78), "\n\n";

foreach ($ids as $id) {
    $st = $pdo->prepare(
        'SELECT u.id, u.email, u.status, u.role, c.prenom, c.nom,
                (SELECT COUNT(*) FROM applications a WHERE a.candidate_id = u.id) AS candidatures,
                (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id AND r.storage_key <> "") AS fichiers,
                (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS sessions
           FROM users u LEFT JOIN candidates c ON c.user_id = u.id
          WHERE u.id = ?'
    );
    $st->execute([$id]);
    $u = $st->fetch();

    if (!$u) {
        echo "  #$id  introuvable — ignore\n";
        continue;
    }
    if ($u['status'] === 'anonymise') {
        echo "  #$id  {$u['email']} — deja anonymise, rien a faire\n";
        continue;
    }
    printf("  #%-4d %-34s %-12s candidatures=%d fichiers=%d sessions=%d\n",
        $u['id'], $u['email'], trim($u['prenom'] . ' ' . $u['nom']) ?: '(sans nom)',
        $u['candidatures'], $u['fichiers'], $u['sessions']);
    $aTraiter[] = $u;
}

if (!$aTraiter) {
    echo "\nRien a faire.\n";
    exit(0);
}

if (!$confirme) {
    echo "\n", count($aTraiter), " compte(s) seraient anonymises.\n";
    echo "Relancer avec --confirmer pour le faire.\n";
    exit(0);
}

echo "\n";
$faits = 0;

foreach ($aTraiter as $u) {
    $id = (int) $u['id'];
    $pdo->beginTransaction();
    try {
        /* Exactement ce que fait DELETE auth/compte : si cette route change,
           celle-ci doit changer avec elle. */
        $pdo->prepare(
            'UPDATE users SET email = CONCAT("supprime+", id, "@invalide"), equipe_user_id = NULL,
                              status = "anonymise", anonymized_at = ? WHERE id = ?'
        )->execute([maintenant(), $id]);
        $pdo->prepare('UPDATE candidates SET prenom = "", initiale = "", nom = "", telephone = "", resume_json = NULL, visible = 0 WHERE user_id = ?')
            ->execute([$id]);
        $pdo->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$id]);

        $st = $pdo->prepare('SELECT storage_key FROM resumes WHERE user_id = ? AND storage_key <> ""');
        $st->execute([$id]);
        $effaces = 0;
        foreach ($st->fetchAll(PDO::FETCH_COLUMN) as $cle) {
            supprimeFichier((string) $cle);
            $effaces++;
        }
        $pdo->prepare('UPDATE resumes SET storage_key = "", enc_iv = NULL, enc_tag = NULL, filename = "supprime" WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM resume_extractions WHERE resume_id IN (SELECT id FROM resumes WHERE user_id = ?)')->execute([$id]);
        $pdo->prepare('UPDATE applications SET statut = "retiree", message = NULL, updated_at = ? WHERE candidate_id = ? AND statut NOT IN ("acceptee","refusee")')->execute([maintenant(), $id]);
        $pdo->prepare('UPDATE api_keys SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')->execute([maintenant(), $id]);
        $pdo->prepare('DELETE FROM match_scores WHERE candidate_id = ?')->execute([$id]);

        trace($id, 'suppression_compte_maintenance', 'user', $id);
        $pdo->commit();
        echo "  #$id anonymise ($effaces fichier(s) efface(s))\n";
        $faits++;
    } catch (Throwable $e) {
        $pdo->rollBack();
        echo "  #$id ECHEC : " . $e->getMessage() . " — ce compte est inchange\n";
    }
}

echo "\n$faits compte(s) anonymise(s).\n";
echo "Le compte reste chez le service de comptes de l'equipe : leur API n'expose\n";
echo "aucune suppression. Il ne peut plus rien faire ici, sa ligne locale etant\n";
echo "anonymisee et sans mot de passe.\n\n";
echo "Relancer le veilleur pour que la passerelle cesse de les exporter :\n";
echo "  php passerelle-cli.php\n";
