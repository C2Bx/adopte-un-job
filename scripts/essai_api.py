# -*- coding: utf-8 -*-
"""Recette de l'API : un parcours complet, candidat et recruteur, jusqu'au match.
   Les comptes crees sont prefixes zz_ et supprimes a la fin — jamais de DELETE
   sans WHERE, jamais de suppression d'autre chose que ce que ce script a cree."""
import json, os, sys, uuid
import requests, urllib3

urllib3.disable_warnings()
sys.stdout.reconfigure(encoding="utf-8")

BASE = os.environ.get("AVP_API", "https://zako.nc/avp/app/api/index.php")
MDP = "recette-adopte-2026"
tag = uuid.uuid4().hex[:8]
CAND = f"zz_cand_{tag}@example.nc"
RECR = f"zz_recr_{tag}@example.nc"

ok = 0
ko = []


def appel(session, methode, route, corps=None, attendu=200):
    global ok
    r = session.request(methode, BASE, params={"r": route}, json=corps, verify=False, timeout=40)
    try:
        d = r.json()
    except Exception:
        d = {"_brut": r.text[:400]}
    if r.status_code == attendu:
        ok += 1
        print("  %-6s %-24s %s" % (methode, route, r.status_code))
    else:
        ko.append("%s %s -> %s (attendu %s) %s" % (methode, route, r.status_code, attendu, json.dumps(d, ensure_ascii=False)[:300]))
        print("  %-6s %-24s %s  ECHEC" % (methode, route, r.status_code))
    return d


c = requests.Session()
e = requests.Session()

print("— presentation")
appel(c, "GET", "")
appel(c, "GET", "referentiels")

print("— comptes")
appel(c, "POST", "auth/inscription", {"email": CAND, "motdepasse": MDP, "role": "candidat"}, 201)
appel(e, "POST", "auth/inscription", {"email": RECR, "motdepasse": MDP, "role": "recruteur"}, 201)
appel(c, "GET", "auth/moi")
appel(c, "POST", "auth/connexion", {"email": CAND, "motdepasse": "faux"}, 401)

print("— le deck est ferme tant que le profil est vide")
d = appel(c, "GET", "deck", None, 409)
print("     manques :", "; ".join(d.get("manques", []))[:120])
appel(c, "POST", "swipes", {"offre": 1, "decision": "oui"}, 409)

print("— profil")
appel(c, "PUT", "profil", {
    "prenom": "Camille", "initiale": "D", "nom": "Dupont", "telephone": "+687 00.00.00",
    "dispo": "2026-10", "teletravail": "hybride", "ouverture": "ouvert",
    "salaireMin": 250000, "permis": True, "formation": 4, "experienceAns": 3,
    "zones": ["Grand Nouméa", "Sud"], "contrats": ["CDI", "Alternance"],
    "metiers": ["developpement", "support-informatique"],
    "competences": ["Développement web", "GLPI", "SQL", "Python", "Automatisation", "dev web"],
    "langues": [{"langue": "Anglais", "niveau": "B2"}],
    "experiences": [{"poste": "Alternance en PME", "secteur": "informatique", "debut": "2023", "fin": "2024"}],
    "formations": [{"niveau": 4, "domaine": "MASTER MIAGE"}],
})
p = appel(c, "GET", "profil")
print("     competences enregistrees :", len(p["profil"]["competences"]),
      "| metiers :", p["profil"]["metiers"])

print("— entreprise et offre")
appel(e, "PUT", "entreprise", {"nom": f"zz Entreprise {tag}", "secteur": "informatique", "taille": "11-50"})
o = appel(e, "POST", "offres", {
    "titre": "Développeur web junior", "metier": "developpement", "contrat": "CDI",
    "zone": "Grand Nouméa", "teletravail": "hybride", "salaireMin": 240000, "salaireMax": 320000,
    "experienceMin": 2, "formationMin": 2, "debut": "2026-11", "statut": "publiee",
    "description": "Reprise et évolution d’applications internes.",
    "requis": ["Développement web", "SQL"], "souhaite": ["Python", "GLPI"],
}, 201)
offre = o.get("offre", {}).get("id")
print("     offre", offre)

print("— deck du candidat")
d = appel(c, "GET", "deck")
trouvee = [x for x in d.get("offres", []) if x["id"] == offre]
if trouvee:
    s = trouvee[0]["score"]
    print("     qualite %d %% (recruteur %d, candidat %d, confiance %d)"
          % (s["qualite"], s["recruteur"], s["candidat"], s["confiance"]))
    print("     nom du candidat visible cote entreprise avant match ?")
else:
    ko.append("l'offre publiee n'apparait pas dans le deck du candidat")

print("— deck du recruteur : masquage avant match")
d = appel(e, "GET", "deck/%d" % offre)
if d.get("candidats"):
    vu = d["candidats"][0]
    fuite = [k for k in ("prenom", "nom", "telephone") if k in vu]
    print("     champs personnels exposes :", fuite or "aucun")
    if fuite:
        ko.append("masquage avant match casse : " + ", ".join(fuite))
else:
    ko.append("le candidat n'apparait pas dans le deck du recruteur")

print("— swipes et match")
r = appel(c, "POST", "swipes", {"offre": offre, "decision": "oui"})
print("     match apres le seul oui du candidat :", r.get("match"))
r = appel(e, "POST", "swipes", {"offre": offre, "candidat": p and 0 or 0, "decision": "oui"}) \
    if False else None
cand_id = d["candidats"][0]["id"] if d.get("candidats") else None
r = appel(e, "POST", "swipes", {"offre": offre, "candidat": cand_id, "decision": "oui"})
match = (r.get("match") or {}).get("id")
print("     match apres les deux oui :", match)

if match:
    m = appel(e, "GET", "matchs/%d" % match)
    print("     apres match, l'entreprise voit :", m.get("candidat", {}).get("prenom"),
          m.get("candidat", {}).get("telephone"))
    appel(e, "POST", "matchs/%d/messages" % match, {"corps": "Bonjour, votre profil nous intéresse."}, 201)
    appel(c, "GET", "matchs/%d/messages" % match)
    appel(e, "POST", "matchs/%d/rdv" % match, {"debut": "2026-10-15 23:00", "mode": "visio", "duree": 45}, 201)
    appel(c, "GET", "matchs")
    appel(c, "GET", "notifications")

print("— droits")
appel(c, "GET", "offres", None, 403)              # un candidat n'est pas recruteur
appel(e, "GET", "profil", None, 403)              # un recruteur n'a pas de profil candidat
sans = requests.Session()
appel(sans, "GET", "deck", None, 401)             # anonyme

print("— conformite")
appel(c, "GET", "auth/export")
appel(c, "DELETE", "auth/compte")
appel(e, "DELETE", "auth/compte")

print("\n%d appels conformes, %d ecarts" % (ok, len(ko)))
for x in ko:
    print("  !", x)
sys.exit(1 if ko else 0)
