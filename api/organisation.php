<?php
/**
 * Adopte un Job — organisations (le groupe RH) : membres, invitations, acces.
 *
 * Une organisation porte les AVP et le tableau de bord. Plusieurs comptes
 * recruteurs y sont rattaches : ils voient les memes offres, les memes
 * candidatures, les memes chiffres. On rejoint une organisation avec un code
 * d'invitation, jamais en devinant son nom.
 */

declare(strict_types=1);

/** L'organisation de l'utilisateur, ou 403. Rend la ligne + le role du membre. */
function organisationDe(PDO $pdo, array $u, bool $exige = true): ?array
{
    $st = $pdo->prepare(
        'SELECT c.*, m.role AS membre_role FROM company_members m JOIN companies c ON c.id = m.company_id
          WHERE m.user_id = ? ORDER BY m.created_at LIMIT 1'
    );
    $st->execute([(int) $u['id']]);
    $o = $st->fetch();
    if (!$o && $u['role'] === 'admin') {
        return null;
    }
    if (!$o && $exige) {
        erreur('organisation_manquante', 'Rejoins ou crée d’abord une organisation.', 409);
    }
    return $o ?: null;
}

function organisationPublique(array $o): array
{
    return [
        'id' => (int) $o['id'], 'nom' => $o['name'], 'slug' => $o['slug'], 'secteur' => $o['sector'],
        'taille' => $o['size'], 'site' => $o['website'], 'pitch' => $o['pitch'], 'source' => $o['source'] ?? 'app',
        'monRole' => $o['membre_role'] ?? null,
    ];
}

/** L'offre appartient-elle a l'organisation ? Sinon 403. */
function exigeOffreDeOrganisation(PDO $pdo, array $org, int $jobId): array
{
    $o = offreParId($pdo, $jobId);
    if (!$o || (int) $o['company_id'] !== (int) $org['id']) {
        erreur('interdit', 'Cette offre n’appartient pas à ton organisation.', 403);
    }
    return $o;
}

function membresOrganisation(PDO $pdo, int $orgId): array
{
    $st = $pdo->prepare(
        'SELECT u.id, u.email, m.role, m.created_at,
                (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = ? AND a.decided_by = u.id) AS decisions
           FROM company_members m JOIN users u ON u.id = m.user_id
          WHERE m.company_id = ? AND u.status = "actif" ORDER BY m.created_at'
    );
    $st->execute([$orgId, $orgId]);
    return array_map(static fn ($r) => [
        'id' => (int) $r['id'], 'email' => $r['email'], 'role' => $r['role'], 'depuis' => $r['created_at'],
        'decisions' => (int) $r['decisions'],
    ], $st->fetchAll());
}

/** Tous les comptes de l'organisation, pour les notifier. */
function membresIds(PDO $pdo, int $orgId): array
{
    $st = $pdo->prepare('SELECT user_id FROM company_members WHERE company_id = ?');
    $st->execute([$orgId]);
    return array_map('intval', $st->fetchAll(PDO::FETCH_COLUMN));
}

/* ----------------------------------------------------------------- routes */

if (route('GET', 'organisation', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $o = organisationDe($pdo, $u, false);
    envoie(['organisation' => $o ? organisationPublique($o) : null]);
}

/* Creer son organisation : le compte devient proprietaire, un code d'invitation
   est genere pour les collegues. */
if (route('POST', 'organisation', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    if (organisationDe($pdo, $u, false)) {
        erreur('deja_membre', 'Tu appartiens déjà à une organisation.', 409);
    }
    $nom = texte('nom', 160, true);
    $slug = slugue($nom) . '-' . substr(bin2hex(random_bytes(3)), 0, 5);
    $pdo->prepare(
        'INSERT INTO companies (name, slug, invite_code, sector, size, website, pitch, source, created_at) VALUES (?,?,?,?,?,?,?,"app",?)'
    )->execute([
        $nom, $slug, codeInvitation(), texte('secteur', 80),
        in_array(champ('taille'), ['1-10', '11-50', '51-200', '200+'], true) ? champ('taille') : null,
        texte('site', 190), mb_substr((string) champ('pitch', ''), 0, 2000), maintenant(),
    ]);
    $cid = (int) $pdo->lastInsertId();
    $pdo->prepare('INSERT INTO company_members (company_id, user_id, role, created_at) VALUES (?,?,"proprietaire",?)')
        ->execute([$cid, (int) $u['id'], maintenant()]);
    trace((int) $u['id'], 'creation_organisation', 'company', $cid);
    envoie(['organisation' => organisationPublique(organisationDe($pdo, $u))], 201);
}

if (route('PUT', 'organisation', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    if ($org['membre_role'] !== 'proprietaire' && $u['role'] !== 'admin') {
        erreur('role_insuffisant', 'Seul le propriétaire modifie l’organisation.', 403);
    }
    $pdo->prepare('UPDATE companies SET name=?, sector=?, size=?, website=?, pitch=? WHERE id=?')->execute([
        texte('nom', 160, true), texte('secteur', 80),
        in_array(champ('taille'), ['1-10', '11-50', '51-200', '200+'], true) ? champ('taille') : null,
        texte('site', 190), mb_substr((string) champ('pitch', ''), 0, 2000), (int) $org['id'],
    ]);
    trace((int) $u['id'], 'maj_organisation', 'company', (int) $org['id']);
    envoie(['organisation' => organisationPublique(organisationDe($pdo, $u))]);
}

/* Rejoindre avec un code d'invitation. Le code est compare en temps constant,
   et limite : douze caracteres sur trente-deux, ca se devine par milliards, pas
   par force brute sur une API freinee. */
if (route('POST', 'organisation/rejoindre', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    limite('rejoindre:' . $u['id'], 10, 3600);
    if (organisationDe($pdo, $u, false)) {
        erreur('deja_membre', 'Tu appartiens déjà à une organisation.', 409);
    }
    $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) champ('code', '')) ?? '');
    $st = $pdo->prepare('SELECT id, name FROM companies WHERE invite_code = ?');
    $st->execute([$code]);
    $c = $st->fetch();
    if (!$c) {
        erreur('code_invalide', 'Ce code d’invitation n’existe pas.', 404);
    }
    $pdo->prepare('INSERT IGNORE INTO company_members (company_id, user_id, role, created_at) VALUES (?,?,"recruteur",?)')
        ->execute([(int) $c['id'], (int) $u['id'], maintenant()]);
    trace((int) $u['id'], 'rejoint_organisation', 'company', (int) $c['id']);
    foreach (membresIds($pdo, (int) $c['id']) as $m) {
        if ($m !== (int) $u['id']) {
            notifie($m, 'nouveau_membre', ['email' => $u['email']]);
        }
    }
    envoie(['organisation' => organisationPublique(organisationDe($pdo, $u))]);
}

if (route('GET', 'organisation/membres', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    envoie([
        'membres' => membresOrganisation($pdo, (int) $org['id']),
        // le code n'est montre qu'aux membres : c'est lui qui ouvre la porte
        'codeInvitation' => $org['invite_code'],
    ]);
}

/* Regenerer le code : l'ancien cesse de fonctionner immediatement. */
if (route('POST', 'organisation/invitation', $seg, $methode) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    if ($org['membre_role'] !== 'proprietaire' && $u['role'] !== 'admin') {
        erreur('role_insuffisant', 'Seul le propriétaire renouvelle le code.', 403);
    }
    $code = codeInvitation();
    $pdo->prepare('UPDATE companies SET invite_code = ? WHERE id = ?')->execute([$code, (int) $org['id']]);
    trace((int) $u['id'], 'nouveau_code_invitation', 'company', (int) $org['id']);
    envoie(['codeInvitation' => $code]);
}

if (($a = route('PUT', 'organisation/membres/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    if ($org['membre_role'] !== 'proprietaire' && $u['role'] !== 'admin') {
        erreur('role_insuffisant', 'Seul le propriétaire change les rôles.', 403);
    }
    $role = in_array(champ('role'), ['proprietaire', 'recruteur', 'lecteur'], true) ? champ('role') : 'recruteur';
    $pdo->prepare('UPDATE company_members SET role = ? WHERE company_id = ? AND user_id = ?')
        ->execute([$role, (int) $org['id'], (int) $a[0]]);
    envoie(['membres' => membresOrganisation($pdo, (int) $org['id'])]);
}

if (($a = route('DELETE', 'organisation/membres/*', $seg, $methode)) !== false) {
    $u = exigeConnexion('recruteur');
    $org = organisationDe($pdo, $u);
    $cible = (int) $a[0];
    if ($cible !== (int) $u['id'] && $org['membre_role'] !== 'proprietaire' && $u['role'] !== 'admin') {
        erreur('role_insuffisant', 'Seul le propriétaire retire un membre.', 403);
    }
    // le dernier proprietaire ne se retire pas : l'organisation deviendrait orpheline
    $st = $pdo->prepare('SELECT COUNT(*) FROM company_members WHERE company_id = ? AND role = "proprietaire"');
    $st->execute([(int) $org['id']]);
    if ($cible === (int) $u['id'] && $org['membre_role'] === 'proprietaire' && (int) $st->fetchColumn() <= 1) {
        erreur('dernier_proprietaire', 'Nomme un autre propriétaire avant de partir.', 409);
    }
    $pdo->prepare('DELETE FROM company_members WHERE company_id = ? AND user_id = ?')->execute([(int) $org['id'], $cible]);
    trace((int) $u['id'], 'retrait_membre', 'company', (int) $org['id']);
    envoie(['ok' => true]);
}
