# -*- coding: utf-8 -*-
"""Le referentiel de l'interface, en fichier statique : beta/public/referentiel.json.

Adopte un Job n'a plus de base (05/10/2026) : ce qui etait lu dans les tables
`occupations`, `skills`, `opt_*` est servi comme une image ou une police, avec
l'interface. Deux sources, toutes deux publiques et versionnees :

  - les listes ecrites a la main ci-dessous (METIERS, COMPETENCES) ;
  - la release SQLite du referentiel metiers de l'OPT-NC
    (github.com/opt-nc/odata-referentiel-metiers), telechargee une fois.

A relancer quand l'une des deux change :  python scripts/referentiel_statique.py
"""
import json, re, sqlite3, unicodedata, urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
REF = BASE / "scripts" / "ref-metiers-opt-nc.sqlite"
URL = "https://github.com/opt-nc/odata-referentiel-metiers/releases/download/v2.0.1/ref-metiers-opt-nc.sqlite"
SORTIE = BASE / "beta" / "public" / "referentiel.json"


# Les metiers et competences libres proposes dans le formulaire, ecrits a la
# main (ils vivaient dans scripts/migre.py, supprime avec la base le 05/10/2026).
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


def slug(t: str) -> str:
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", t.lower()).strip("-")


def propre(libelle: str) -> str:
    libelle = libelle.strip()
    return libelle.capitalize() if libelle.isupper() else libelle


if not REF.exists():
    urllib.request.urlretrieve(URL, REF)
lite = sqlite3.connect(REF)

couleurs = dict(lite.execute("SELECT famille_metier_id, couleur_hex FROM famille_metier_couleur"))
familles = [{"id": str(i), "libelle": propre(l), "couleur": couleurs.get(i)}
            for i, l in lite.execute("SELECT famille_metier_id, libelle FROM famille_metier")]
libelle_famille = {f["id"]: f["libelle"] for f in familles}
metiers_opt = [{"code": c, "nom": n.strip(), "famille": str(f), "familleLibelle": libelle_famille.get(str(f))}
               for c, n, f, a in lite.execute(
                   "SELECT code_metier, nom_metier, famille_metier_id, metier_actif FROM metier")
               if str(a) in ("1", "true")]
competences_opt = [{"code": c, "nom": n.strip(), "groupe": g}
                   for c, n, g in lite.execute(
                       "SELECT code_competence, nom_competence, groupe_competence_id FROM competence")]
metier_competences = {}
for m, c, p, niv, actif in lite.execute(
        "SELECT code_metier, code_competence, poids, niveau_requis, est_actif FROM metier_competence"):
    if str(actif) in ("1", "true"):
        metier_competences.setdefault(m, []).append({"code": c, "poids": p or 1, "niveau": niv})

referentiel = {
    "zones": ["Grand Nouméa", "Sud", "Nord", "Îles"],
    "contrats": ["CDI", "CDD", "Alternance", "Intérim", "Stage"],
    "niveauxLangue": ["A1", "A2", "B1", "B2", "C1", "C2"],
    "formations": {"1": "Bac", "2": "Bac+2", "3": "Bac+3", "4": "Bac+5"},
    "metiers": [{"slug": s, "label": l, "family": f} for s, l, f in METIERS],
    "competences": [{"slug": slug(l), "label": l, "family": f}
                    for f, labels in COMPETENCES for l in labels],
    "metiersOpt": sorted(metiers_opt, key=lambda m: ((m["familleLibelle"] or ""), m["nom"])),
    "familles": sorted(familles, key=lambda f: f["libelle"]),
    "competencesOpt": sorted(competences_opt, key=lambda c: c["nom"]),
    "metierCompetences": metier_competences,
    "villes": [],     # remplies a l'execution depuis les offres
}
SORTIE.parent.mkdir(parents=True, exist_ok=True)
SORTIE.write_text(json.dumps(referentiel, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
print(f"{SORTIE.relative_to(BASE)} : {len(referentiel['metiersOpt'])} metiers OPT, "
      f"{len(competences_opt)} competences OPT, {len(referentiel['metiers'])} metiers, "
      f"{len(referentiel['competences'])} competences, {SORTIE.stat().st_size // 1024} ko")
