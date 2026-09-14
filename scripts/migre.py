# -*- coding: utf-8 -*-
"""Applique schema.sql puis les referentiels sur avp_prod. Idempotent :
   CREATE TABLE IF NOT EXISTS et INSERT IGNORE, on peut relancer sans risque."""
import os, pathlib, re, sys
import pymysql

sys.stdout.reconfigure(encoding="utf-8")
BASE = pathlib.Path(__file__).resolve().parent / ".."
PWD = os.environ["AVP_DB_PASS"]                    # jamais dans un fichier du depot

cx = pymysql.connect(host=os.environ.get("AVP_DB_HOST", "localhost"), user=os.environ.get("AVP_DB_USER", "avp"), password=PWD,
                     database=os.environ.get("AVP_DB_NAME", "avp"), charset="utf8mb4", autocommit=True)
cur = cx.cursor()

sql = (BASE / "api/schema.sql").read_text(encoding="utf-8")
sql = re.sub(r"^\s*--.*$", "", sql, flags=re.M)
for ordre in [o.strip() for o in sql.split(";") if o.strip()]:
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

cur.execute("SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME")
tables = cur.fetchall()
print("%d tables" % len(tables))
for n, _ in tables:
    cur.execute("SELECT COUNT(*) FROM `%s`" % n)
    print("  %-24s %d" % (n, cur.fetchone()[0]))
