# -*- coding: utf-8 -*-
"""Applique schema.sql, puis les migrations de api/migrations/, puis les
   referentiels (maison + OPT-NC) sur la base. Idempotent : CREATE TABLE IF NOT
   EXISTS, INSERT IGNORE, et les ALTER sont sautes si la colonne existe deja.

   Variables : AVP_DB_HOST, AVP_DB_USER, AVP_DB_PASS, AVP_DB_NAME.
   Option --sans-opt pour ne pas telecharger le referentiel OPT (770 ko)."""
import os, pathlib, re, sqlite3, sys, urllib.request
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
BASE = pathlib.Path(__file__).resolve().parent / ".."
PWD = os.environ["AVP_DB_PASS"]                    # jamais dans un fichier du depot

cx = pymysql.connect(host=os.environ.get("AVP_DB_HOST", "localhost"), user=os.environ.get("AVP_DB_USER", "avp"), password=PWD,
                     database=os.environ.get("AVP_DB_NAME", "avp"), charset="utf8mb4", autocommit=True)
cur = cx.cursor()


def ordres(sql):
    sql = re.sub(r"^\s*--(?!\s*@).*$", "", sql, flags=re.M)      # commentaires, sauf les @directives
    return [o.strip() for o in sql.split(";") if o.strip()]


def colonne_existe(table, colonne):
    cur.execute("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
                (table, colonne))
    return cur.fetchone() is not None


def type_colonne(table, colonne):
    cur.execute("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=%s AND COLUMN_NAME=%s",
                (table, colonne))
    r = cur.fetchone()
    return r[0] if r else None


for ordre in ordres((BASE / "api/schema.sql").read_text(encoding="utf-8")):
    try:
        cur.execute(ordre)
    except Exception as e:
        print("ECHEC :", ordre[:90].replace("\n", " "), "->", e)
        sys.exit(1)

# ------------------------------------------------------------- migrations
for f in sorted((BASE / "api/migrations").glob("*.sql")):
    print("migration", f.name)
    for ordre in ordres(f.read_text(encoding="utf-8")):
        m = re.match(r"--\s*@(alter|modify)\s+(\w+)\s+(\w+)\s*\n(.*)", ordre, re.S)
        if m:
            kind, table, col, ordre = m.groups()
            if kind == "alter" and colonne_existe(table, col):
                continue
            if kind == "modify" and "lecteur" in (type_colonne(table, col) or ""):
                continue
        try:
            cur.execute(ordre)
        except Exception as e:
            print("ECHEC :", ordre[:90].replace("\n", " "), "->", e)
            sys.exit(1)

# ------------------------------------------------------------- referentiels
METIERS = [
    ("support-informatique", "Support informatique", "informatique"),
    ("administration-systeme", "Administration système", "informatique"),
    ("developpement", "Développement", "informatique"),
    ("donnees", "Données", "informatique"),
    ("telecom", "Télécom & réseaux", "informatique"),
    ("relation-client", "Relation client", "tertiaire"),
    ("commerce", "Commerce & vente", "tertiaire"),
    ("comptabilite", "Comptabilité & gestion", "tertiaire"),
    ("rh", "Ressources humaines", "tertiaire"),
    ("formation", "Formation", "tertiaire"),
    ("logistique", "Logistique & transport", "operations"),
    ("industrie", "Industrie & maintenance", "operations"),
    ("btp", "BTP & second œuvre", "operations"),
    ("securite", "Sécurité", "operations"),
    ("environnement", "Environnement", "operations"),
    ("sante", "Santé & social", "services"),
    ("restauration", "Restauration", "services"),
    ("hotellerie", "Hôtellerie & tourisme", "services"),
]
cur.executemany("INSERT IGNORE INTO occupations (slug, label, family) VALUES (%s,%s,%s)", METIERS)

# Proximites : ecrites a la main, discutables, donc corrigeables. Une distance
# devinee par un modele ne se discute pas — celle-ci si.
PROCHES = [
    ("support-informatique", "administration-systeme", 0.75, "mêmes outils, même parc, montée en responsabilité"),
    ("support-informatique", "telecom", 0.60, "réseau et postes se recouvrent largement"),
    ("support-informatique", "relation-client", 0.45, "le support est d'abord un métier de relation"),
    ("administration-systeme", "telecom", 0.70, "infrastructure commune"),
    ("administration-systeme", "developpement", 0.50, "automatisation, scripts, CI"),
    ("developpement", "donnees", 0.65, "SQL et modélisation partagés"),
    ("developpement", "support-informatique", 0.45, "porte d'entrée fréquente vers le développement"),
    ("donnees", "comptabilite", 0.45, "chiffres, contrôle, rapprochement"),
    ("relation-client", "commerce", 0.70, "prospection et suivi client"),
    ("relation-client", "hotellerie", 0.50, "accueil et gestion de l'insatisfaction"),
    ("commerce", "hotellerie", 0.45, "vente de service en face à face"),
    ("comptabilite", "rh", 0.55, "paie à la charnière des deux"),
    ("rh", "formation", 0.60, "recrutement et développement des compétences"),
    ("formation", "sante", 0.35, "pédagogie et accompagnement"),
    ("logistique", "industrie", 0.60, "flux, stocks, sécurité"),
    ("logistique", "btp", 0.45, "approvisionnement de chantier"),
    ("industrie", "btp", 0.55, "habilitations et lecture de plans communes"),
    ("industrie", "environnement", 0.45, "traitement, réseaux, maintenance"),
    ("btp", "environnement", 0.40, "travaux et normes"),
    ("securite", "logistique", 0.40, "sites, accès, procédures"),
    ("restauration", "hotellerie", 0.75, "même secteur, mêmes rythmes"),
    ("restauration", "commerce", 0.40, "service, caisse, gestion de flux"),
    ("sante", "securite", 0.35, "gestes d'urgence, responsabilité"),
]
cur.execute("SELECT slug, id FROM occupations")
occ = dict(cur.fetchall())
liens = []
for a, b, prox, raison in PROCHES:
    liens.append((occ[a], occ[b], prox, raison))
    liens.append((occ[b], occ[a], prox, raison))     # la proximite est symetrique
cur.executemany("INSERT IGNORE INTO occupation_links (a_id, b_id, proximity, reason) VALUES (%s,%s,%s,%s)", liens)

COMPETENCES = [
    ("informatique", ["Windows Server", "Active Directory", "Réseau", "Système", "Linux", "Docker",
        "Virtualisation", "SQL", "MySQL", "PostgreSQL", "Base de données", "Python", "JavaScript",
        "TypeScript", "PHP", "React", "Vue", "Angular", "Node", "HTML", "CSS", "Git", "WordPress",
        "Symfony", "Laravel", "Java", "API", "Développement web", "Développement", "Intégration",
        "Cybersécurité", "Support informatique", "Helpdesk", "GLPI", "Sauvegarde", "Maintenance",
        "Automatisation"]),
    ("outils", ["Excel", "Word", "PowerPoint", "Bureautique", "Power BI", "Figma", "Photoshop",
        "Illustrator", "Canva", "SEO", "CRM", "ERP", "Sage"]),
    ("gestion", ["Gestion de projet", "Management", "Encadrement", "Relation client", "Vente",
        "Accueil", "Comptabilité", "Paie", "Recrutement", "Formation", "Pédagogie", "Communication",
        "Rédaction", "Marketing", "Analyse", "Logistique", "Achats", "Qualité"]),
    ("terrain", ["CACES", "HACCP", "Habilitation électrique", "Soudure", "Lecture de plans",
        "Sécurité chantier", "Électricité", "Mécanique", "Électrotechnique", "Soins", "Conduite"]),
    ("transverse", ["Travail en équipe", "Autonomie", "Rigueur", "Organisation"]),
]


def slug(t):
    import unicodedata
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


lignes = [(slug(lab), lab, fam) for fam, labs in COMPETENCES for lab in labs]
cur.executemany("INSERT IGNORE INTO skills (slug, label, family) VALUES (%s,%s,%s)", lignes)

cur.execute("SELECT slug, id FROM skills")
sk = dict(cur.fetchall())
ALIAS = {
    "dev web": "developpement-web", "developpeur web": "developpement-web",
    "web developer": "developpement-web", "front end": "developpement-web",
    "js": "javascript", "ts": "typescript", "postgres": "postgresql",
    "bdd": "base-de-donnees", "base de donnee": "base-de-donnees",
    "ad": "active-directory", "windows serveur": "windows-server",
    "support n1": "support-informatique", "support niveau 1": "support-informatique",
    "hot line": "helpdesk", "hotline": "helpdesk",
    "gestion de projets": "gestion-de-projet", "chef de projet": "gestion-de-projet",
    "compta": "comptabilite", "resp qualite": "qualite",
    "caces r489": "caces", "habilitation elec": "habilitation-electrique",
    "travail d equipe": "travail-en-equipe", "esprit d equipe": "travail-en-equipe",
    "ms excel": "excel", "power point": "powerpoint",
    "relation clientele": "relation-client", "service client": "relation-client",
}
cur.executemany("INSERT IGNORE INTO skill_aliases (alias, skill_id) VALUES (%s,%s)",
                [(a, sk[s]) for a, s in ALIAS.items() if s in sk])

# ------------------------------------------------------------ referentiel OPT
# La release SQLite d'odata-referentiel-metiers, versee telle quelle dans les
# tables opt_*. Le fichier est telecharge une fois a cote du script.
if "--sans-opt" not in sys.argv:
    REF = BASE / "scripts" / "ref-metiers-opt-nc.sqlite"
    if not REF.exists():
        url = "https://github.com/opt-nc/odata-referentiel-metiers/releases/download/v2.0.1/ref-metiers-opt-nc.sqlite"
        print("telechargement du referentiel OPT", url)
        urllib.request.urlretrieve(url, REF)
    lite = sqlite3.connect(REF)
    fam = {r[0]: r for r in lite.execute("SELECT famille_metier_id, libelle FROM famille_metier")}
    coul = dict(lite.execute("SELECT famille_metier_id, couleur_hex FROM famille_metier_couleur"))
    cur.executemany("INSERT INTO opt_familles (id, libelle, couleur) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE libelle=VALUES(libelle), couleur=VALUES(couleur)",
                    [(k, v[1].strip().capitalize() if v[1].isupper() else v[1].strip(), coul.get(k)) for k, v in fam.items()])
    cur.executemany("INSERT INTO opt_metiers (code_metier, nom, famille_id, actif) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE nom=VALUES(nom), famille_id=VALUES(famille_id), actif=VALUES(actif)",
                    [(c, n.strip(), f, 1 if str(a) in ("1", "true") else 0)
                     for c, n, f, a in lite.execute("SELECT code_metier, nom_metier, famille_metier_id, metier_actif FROM metier")])

    def slug(t):
        import unicodedata
        t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()
        return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")

    cur.executemany("INSERT INTO opt_competences (code, nom, groupe, slug) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE nom=VALUES(nom), groupe=VALUES(groupe), slug=VALUES(slug)",
                    [(c, n.strip(), g, slug(n)[:255]) for c, n, g in lite.execute("SELECT code_competence, nom_competence, groupe_competence_id FROM competence")])
    cur.executemany("INSERT INTO opt_metier_competences (code_metier, code_competence, poids, niveau_requis) VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE poids=VALUES(poids), niveau_requis=VALUES(niveau_requis)",
                    [(m, c, p or 1, n) for m, c, p, n, a in lite.execute("SELECT code_metier, code_competence, poids, niveau_requis, est_actif FROM metier_competence") if str(a) in ("1", "true")])
    cur.executemany("INSERT IGNORE INTO opt_niveaux (code_competence, niveau, description) VALUES (%s,%s,%s)",
                    [(c, int(n), d) for c, n, d in lite.execute("SELECT code_competence, niveau, description FROM niveau_description_competence")])
    print("referentiel OPT charge")

cur.execute("SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME")
tables = cur.fetchall()
print("%d tables" % len(tables))
for n, _ in tables:
    cur.execute("SELECT COUNT(*) FROM `%s`" % n)
    print("  %-24s %d" % (n, cur.fetchone()[0]))
