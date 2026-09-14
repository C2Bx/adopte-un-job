# -*- coding: utf-8 -*-
"""Amorce la base de production avec les 22 offres ecrites pour la maquette.
   Elles ne sont pas fictives par paresse : elles couvrent 18 secteurs et servent
   a verifier que le moteur classe correctement au-dela de l'informatique.
   Idempotent : une offre deja presente (meme entreprise, meme titre) est ignoree."""
import os, json, re, subprocess, sys, unicodedata
import pymysql

sys.stdout.reconfigure(encoding="utf-8")

offres = json.loads(subprocess.run(
    ["node", "-e", "global.window={};require('./prototype/assets/data.js');"
                   "process.stdout.write(JSON.stringify(global.window.AJ_DATA.offres))"],
    capture_output=True, text=True, encoding="utf-8", check=True).stdout)


def slug(t):
    t = unicodedata.normalize("NFD", t).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


cx = pymysql.connect(host=os.environ.get("AVP_DB_HOST", "localhost"), user=os.environ.get("AVP_DB_USER", "avp"),
                     password=os.environ["AVP_DB_PASS"],
                     database=os.environ.get("AVP_DB_NAME", "avp"), charset="utf8mb4", autocommit=True)
cur = cx.cursor()

cur.execute("SELECT slug, id FROM occupations")
occ = dict(cur.fetchall())
cur.execute("SELECT slug, id FROM skills")
sk = dict(cur.fetchall())


def idCompetence(libelle):
    s = slug(libelle)
    if s in sk:
        return sk[s]
    cur.execute("INSERT IGNORE INTO skills (slug, label, family) VALUES (%s,%s,'libre')", (s, libelle[:80]))
    cur.execute("SELECT id FROM skills WHERE slug = %s", (s,))
    sk[s] = cur.fetchone()[0]
    return sk[s]


CONTRATS = {"CDI", "CDD", "Alternance", "Intérim", "Stage"}
ZONES = {"Grand Nouméa", "Sud", "Nord", "Îles"}

societes, ajoutees, ignorees = {}, 0, 0
for o in offres:
    nom = o["org"]
    if nom not in societes:
        cur.execute("SELECT id FROM companies WHERE name = %s", (nom,))
        r = cur.fetchone()
        if r:
            societes[nom] = r[0]
        else:
            cur.execute(
                "INSERT INTO companies (name, sector, size, pitch, created_at)"
                " VALUES (%s,%s,%s,%s,UTC_TIMESTAMP())",
                (nom, o.get("famille"), "11-50", o.get("resume", "")[:2000]))
            societes[nom] = cur.lastrowid
    cid = societes[nom]

    cur.execute("SELECT id FROM jobs WHERE company_id = %s AND titre = %s", (cid, o["titre"]))
    if cur.fetchone():
        ignorees += 1
        continue

    sal = o.get("salaire") or [None, None]
    tt = o.get("teletravail") or "non"
    cur.execute(
        """INSERT INTO jobs (company_id, titre, occupation_id, contrat, zone, teletravail,
                             salaire_min, salaire_max, experience_min, formation_min,
                             permis_requis, debut, description, statut, published_at,
                             expires_at, created_at, updated_at)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'publiee',UTC_TIMESTAMP(),
                   %s,UTC_TIMESTAMP(),UTC_TIMESTAMP())""",
        (cid, o["titre"], occ.get(slug(o["famille"])),
         o["contrat"] if o["contrat"] in CONTRATS else "CDI",
         o["zone"] if o["zone"] in ZONES else "Grand Nouméa",
         tt if tt in ("non", "hybride", "total") else "non",
         sal[0], sal[1], o.get("expMin", 0), o.get("formation"),
         1 if o.get("permis") else 0,
         (o.get("dispo") or "")[:7] or None,
         "\n".join([o.get("resume", "")] + ["• " + m for m in o.get("missions", [])])[:6000],
         (o.get("fin") or "")[:10].replace("T", " ") + " 00:00:00" if o.get("fin") else None))
    jid = cur.lastrowid

    for lib in o.get("requis", []):
        cur.execute("INSERT IGNORE INTO job_skills (job_id, skill_id, niveau) VALUES (%s,%s,'exige')",
                    (jid, idCompetence(lib)))
    for lib in o.get("souhaite", []):
        cur.execute("INSERT IGNORE INTO job_skills (job_id, skill_id, niveau) VALUES (%s,%s,'souhaite')",
                    (jid, idCompetence(lib)))
    ajoutees += 1

cur.execute("SELECT COUNT(*) FROM jobs WHERE statut='publiee'")
print("offres publiees : %d (ajoutees %d, deja presentes %d)" % (cur.fetchone()[0], ajoutees, ignorees))
cur.execute("SELECT COUNT(*) FROM companies")
print("entreprises : %d" % cur.fetchone()[0])
cur.execute("SELECT COUNT(*) FROM skills WHERE family='libre'")
print("competences ajoutees hors referentiel : %d" % cur.fetchone()[0])
