# -*- coding: utf-8 -*-
"""Recette de l'API, de bout en bout : candidat, organisation a deux membres,
   AVP reels, candidature, preselection (match), dossier, entretien, agenda,
   tableau de bord, messages, export, suppression.

   Deux transports :
     AVP_API=https://…/index.php   → HTTP (production, staging)
     sans AVP_API                  → CLI local (scripts/appel_cli.php), quand un
                                     antivirus ou un proxy bloque le serveur de dev.

   Les comptes crees sont prefixes zz_ et supprimes a la fin par leur propre
   session (DELETE auth/compte). Jamais de DELETE sans WHERE."""
import json, os, subprocess, sys, uuid, pathlib

sys.stdout.reconfigure(encoding="utf-8")
ICI = pathlib.Path(__file__).resolve().parent
BASE = os.environ.get("AVP_API")
tag = uuid.uuid4().hex[:6]
CAND = f"zz_cand_{tag}@example.nc"
RH1 = f"zz_rh1_{tag}@example.nc"
RH2 = f"zz_rh2_{tag}@example.nc"
MDP = "recette-adopte-un-job-2026"
ecarts = 0
n = 0


def appel(methode, route, corps=None, token="", query=None, attendu=200, brut=False):
    global n, ecarts
    n += 1
    if BASE:
        import requests, urllib3
        urllib3.disable_warnings()
        h = {"Accept": "application/json"}
        if token:
            h["Authorization"] = "Bearer " + token
        r = requests.request(methode, BASE, params=dict(query or {}, r=route), json=corps, headers=h, verify=False, timeout=90)
        statut, texte = r.status_code, r.text
    else:
        env = dict(os.environ, AVP_METHOD=methode, AVP_ROUTE=route, AVP_TOKEN=token, AVP_QUERY=json.dumps(query or {}), AVP_HEADERS="{}")
        p = subprocess.run(["php", str(ICI / "appel_cli.php")], input=(json.dumps(corps) if corps is not None else "").encode(),
                           capture_output=True, env=env, timeout=180)
        out = p.stdout.decode("utf-8", "replace")
        texte, _, st = out.rpartition("\n__STATUS__=")
        statut = int(st or 0)
        if p.stderr:
            texte += "\n[stderr] " + p.stderr.decode("utf-8", "replace")[:300]
    ok = statut == attendu
    if not ok:
        ecarts += 1
    print(f"  {'ok ' if ok else 'ECART'} {methode:6} {route:38} {statut}" + ("" if ok else f" (attendu {attendu}) {texte[:200]}"))
    if brut:
        return texte
    try:
        return json.loads(texte)
    except Exception:
        return {}


def depose(route, token, nom, contenu, mime, attendu=201):
    """Envoi multipart (fichier de CV). Seulement en HTTPS : la ligne de
    commande ne sait pas fabriquer $_FILES ; on note l'appel comme saute."""
    global n, ecarts
    n += 1
    if not BASE:
        print(f"  saut  POST   {route:38} (multipart : HTTPS seulement)")
        return None
    import requests
    r = requests.post(BASE, params={"r": route}, files={"fichier": (nom, contenu, mime)},
                      headers={"Authorization": "Bearer " + token}, verify=False, timeout=90)
    ok = r.status_code == attendu
    if not ok:
        ecarts += 1
    print(f"  {'ok ' if ok else 'ECART'} POST   {route:38} {r.status_code}" + ("" if ok else f" (attendu {attendu}) {r.text[:200]}"))
    try:
        return r.json()
    except Exception:
        return {}


def ligne(t):
    print("\n== " + t)


# ---------------------------------------------------------------- catalogue public
ligne("catalogue public")
r = appel("GET", "")
assert "routes" in r
r = appel("GET", "avp", query={"statut": "ouvert"})
nb_avp = r.get("total", 0)
print(f"  {nb_avp} AVP ouverts, facettes villes={len(r['facettes']['ville'])} familles={len(r['facettes']['famille'])} métiers={len(r['facettes']['metier'])}")
assert nb_avp > 0, "aucun AVP : lancer la synchronisation d'abord"
premier = r["offres"][0]
r = appel("GET", "avp", query={"q": "client", "province": "province Sud"})
print(f"  recherche « client » province Sud : {r['total']}")
r = appel("GET", "avp/filtres")
r = appel("GET", f"avp/{premier['id']}")
assert r["offre"]["id"] == premier["id"]
appel("POST", f"avp/{premier['id']}/vue", {"source": "lien"})
r = appel("GET", "metiers")
print(f"  {len(r['metiers'])} métiers OPT, {len(r['familles'])} familles")
code_metier = premier.get("codeMetier") or "OP005"
r = appel("GET", f"metiers/{code_metier}")
print(f"  {code_metier} = {r['metier']['nom']}, {len(r['metier']['competences'])} compétences")
appel("GET", "competences", query={"q": "vente"})
appel("GET", "avp/999999999", attendu=404)

# ---------------------------------------------------------------- candidat
ligne("candidat")
r = appel("POST", "auth/inscription", {"email": CAND, "motdepasse": MDP, "role": "candidat"}, attendu=201)
tc = r["jeton"]
appel("GET", "auth/moi", token=tc)
appel("GET", "deck", token=tc, attendu=409)          # profil vide : verrou
comp_metier = [c["nom"] for c in appel("GET", f"metiers/{code_metier}")["metier"]["competences"][:4]]
profil = {
    "prenom": "Camille", "initiale": "D", "nom": "Dupont", "telephone": "+687 00.00.00", "dispo": "2026-11",
    "zones": ["Grand Nouméa", "Sud"], "contrats": ["CDI", "CDD"], "metiers": [], "metiersOpt": [code_metier],
    "competences": comp_metier + ["Relation client", "Bureautique", "Rigueur"],
    "langues": [{"langue": "Anglais", "niveau": "B1"}],
    "experiences": [{"poste": "Chargé de clientèle", "secteur": "banque", "debut": "2022-01", "fin": "2025-06"}],
    "formations": [{"niveau": 2, "domaine": "BTS Négociation"}], "formation": 2, "experienceAns": 3,
    "permis": True, "teletravail": "peu importe", "salaireMin": None, "ouverture": "ouvert",
}
r = appel("PUT", "profil", profil, token=tc)
print(f"  métiers OPT : {[m['nom'] for m in r['profil']['metiersOpt']]} ; compétences rattachées : {len(r['profil']['competencesOpt'])}")
assert r["profil"]["metiersOpt"], "metiersOpt non enregistré"
assert len(r["profil"]["competencesOpt"]) >= 3, "rattachement au référentiel trop faible"
appel("GET", "profil/jsonresume", token=tc)
appel("GET", "profil/cv.pdf", token=tc, brut=True)
r = appel("POST", "profil/cv", {"nom": "cv.pdf", "mime": "application/pdf", "octets": 1234, "sha256": "0" * 64, "moteur": "pdfjs", "version": "6.3", "brut": {"prenom": "Camille"}, "retenu": {}}, token=tc, attendu=201)
cv_id = r["cv"]["id"]
r = appel("PUT", f"profil/cv/{cv_id}", {"retenu": {"prenom": "Camille"}, "actif": True}, token=tc)
assert r["cv"]["lecture"]["retenu"] == {"prenom": "Camille"}, "accepted non enregistré"
r = appel("GET", "profil/cv", token=tc)
assert r["actif"]["id"] == cv_id
# le vrai fichier : chiffre au depot, refuse s'il n'est ni PDF ni image
MINI_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
fichier = depose("profil/cv/fichier", tc, "cv.pdf", MINI_PDF, "application/pdf")
if fichier is not None:
    assert fichier["cv"]["fichier"] is True and fichier["cv"]["actif"] is True, "le fichier depose devient le CV actif"
    depose("profil/cv/fichier", tc, "cv.txt", b"pas un cv", "text/plain", attendu=415)

r = appel("GET", "deck", token=tc)
deck = r["offres"]
print(f"  deck : {len(deck)} offres, meilleure {deck[0]['titre']!r} qualité {deck[0]['score']['qualite']} % (passerelle={deck[0]['score']['passerelle']}, écarts={deck[0]['score']['ecarts']})")
assert all("score" in o for o in deck)
r = appel("GET", "deck", token=tc, query={"q": "client", "teletravail": "0"})
r = appel("GET", "deck", token=tc, query={"clos": "1"})
print(f"  deck avec les clos : {len(r['offres'])}")
cible = next((o for o in deck if o["statut"] == "publiee"), deck[0])
appel("POST", "swipes", {"offre": deck[-1]["id"], "decision": "non"}, token=tc)
appel("POST", "swipes", {"offre": deck[-2]["id"], "decision": "plus_tard"}, token=tc)
r = appel("POST", "swipes", {"offre": cible["id"], "decision": "oui", "message": "Très intéressée par ce poste."}, token=tc, attendu=201)
cand_id = r["candidature"]["id"]
print(f"  candidature #{cand_id} créée par le swipe oui")
r = appel("GET", "interets", token=tc)
assert any(x.get("candidature", {}) and x["candidature"]["id"] == cand_id for x in r["interets"])
r = appel("GET", "candidatures", token=tc)
assert r["candidatures"][0]["id"] == cand_id and r["candidatures"][0]["statut"] == "envoyee"
appel("GET", f"candidatures/{cand_id}/cv.pdf", token=tc, brut=True)
appel("GET", f"candidatures/{cand_id}/suggestions", token=tc)
appel("DELETE", f"swipes/{deck[-1]['id']}", token=tc)

# ---------------------------------------------------------------- organisation
ligne("organisation")
r = appel("POST", "auth/inscription", {"email": RH1, "motdepasse": MDP, "role": "recruteur", "organisation": f"zz Organisation {tag}"}, attendu=201)
t1 = r["jeton"]
assert r["utilisateur"]["organisation"], "organisation non créée à l'inscription"
r = appel("GET", "organisation/membres", token=t1)
code = r["codeInvitation"]
r = appel("POST", "auth/inscription", {"email": RH2, "motdepasse": MDP, "role": "recruteur", "code": code}, attendu=201)
t2 = r["jeton"]
assert r["utilisateur"]["organisation"], "code d'invitation non reconnu"
r = appel("GET", "organisation/membres", token=t2)
assert len(r["membres"]) == 2, "les deux comptes doivent voir la même organisation"
appel("POST", "organisation/invitation", token=t2, attendu=403)   # pas propriétaire
appel("POST", "organisation/invitation", token=t1)
appel("GET", "candidatures", token=t1)                            # vide : l'AVP est à l'OPT
# une offre propre à l'organisation
r = appel("POST", "offres", {"titre": f"zz Chargé de clientèle {tag}", "codeMetier": code_metier, "contrat": "CDI", "zone": "Grand Nouméa",
                             "ville": "Nouméa", "statut": "publiee", "description": "Accueil et conseil.",
                             "competencesTexte": comp_metier[:3] + ["Relation client"], "expire": "2027-01-31"}, token=t1, attendu=201)
offre_id = r["offre"]["id"]
r = appel("GET", "offres", token=t2)
assert any(o["id"] == offre_id for o in r["offres"]), "le collègue doit voir l'offre"
appel("PUT", f"offres/{offre_id}", {"titre": f"zz Chargé de clientèle {tag} (maj)", "codeMetier": code_metier, "contrat": "CDI", "zone": "Grand Nouméa", "statut": "publiee"}, token=t2)

# le candidat candidate a l'offre de l'organisation
r = appel("POST", "candidatures", {"offre": offre_id, "message": "Bonjour"}, token=tc, attendu=201)
cand2 = r["candidature"]["id"]
r = appel("GET", f"avp/{offre_id}/candidats", token=t1)
assert r["candidats"] and r["candidats"][0].get("candidature"), "candidat absent de la file"
assert "prenom" not in r["candidats"][0], "le prénom ne doit pas être visible avant présélection"
r = appel("GET", f"avp/{offre_id}/candidats", token=t1, query={"vivier": "1"})
r = appel("GET", "candidatures", token=t2, query={"offre": offre_id})
assert r["candidatures"][0]["id"] == cand2
appel("GET", f"candidatures/{cand2}/cv.pdf", token=t2, attendu=403)   # dossier fermé avant présélection
r = appel("GET", f"candidatures/{cand2}", token=t2)
assert r["candidature"]["statut"] == "vue", "l'ouverture doit marquer « vue »"
r = appel("PUT", f"candidatures/{cand2}/statut", {"statut": "preselection"}, token=t1)
assert r["candidature"]["statut"] == "preselection" and r["candidature"]["match"], "la présélection doit ouvrir un match"
match_id = r["candidature"]["match"]
assert r["candidature"]["candidat"]["prenom"] == "Camille", "le contact s'ouvre à la présélection"
pdf = appel("GET", f"candidatures/{cand2}/cv.pdf", token=t2, brut=True)
assert pdf.startswith("%PDF"), "le CV généré doit être un PDF"
if BASE:
    orig = appel("GET", f"candidatures/{cand2}/cv-original", token=t2, brut=True)
    assert orig.startswith("%PDF"), "le CV d'origine doit revenir dechiffre, tel que depose"
else:
    appel("GET", f"candidatures/{cand2}/cv-original", token=t2, attendu=404)   # aucun fichier depose (CLI)
r = appel("GET", f"candidatures/{cand2}/suggestions", token=t1)
assert len(r["suggestions"]) == 3

# ---------------------------------------------------------------- messages + agenda
ligne("messages et agenda")
r = appel("GET", "matchs", token=tc)
assert r["matchs"][0]["id"] == match_id
r = appel("GET", f"matchs/{match_id}/suggestions", token=tc)
appel("POST", f"matchs/{match_id}/messages", {"corps": r["suggestions"][0]}, token=tc, attendu=201)
r = appel("GET", "matchs", token=t2)
assert r["matchs"][0]["non_lus"] == 1, "le collègue doit voir le message non lu"
appel("GET", f"matchs/{match_id}/messages", token=t2)
appel("POST", f"matchs/{match_id}/messages", {"corps": "Merci, je vous propose des créneaux."}, token=t2, attendu=201)
r = appel("POST", f"candidatures/{cand2}/entretiens", {"creneaux": [{"debut": "2027-01-12 08:00"}, {"debut": "2027-01-13 03:30"}], "duree": 45, "mode": "visio"}, token=t2, attendu=201)
ent = r["entretiens"]
assert len(ent) == 2
r = appel("GET", "agenda", token=tc)
assert len(r["entretiens"]) == 2
r = appel("PUT", f"entretiens/{ent[0]['id']}", {"statut": "confirme"}, token=tc)
r = appel("GET", "agenda", token=t1)
statuts = sorted(e["statut"] for e in r["entretiens"])
assert statuts == ["annule", "confirme"], f"le second créneau doit s'annuler : {statuts}"
ics = appel("GET", f"entretiens/{ent[0]['id']}/ics", token=tc, brut=True)
assert "BEGIN:VCALENDAR" in ics
r = appel("GET", f"candidatures/{cand2}", token=tc)
assert r["candidature"]["statut"] == "entretien"
appel("GET", "notifications", token=tc)
appel("POST", "notifications/lu", token=tc)

# ---------------------------------------------------------------- tableau de bord
ligne("tableau de bord")
r = appel("GET", "organisation/tableau", token=t2, query={"periode": "30"})
t = r["tableau"]
ind = {i["cle"]: i["valeur"] for i in t["indicateurs"]}
print(f"  vues={ind['vues']} candidatures={ind['candidatures']} matchs={ind['matchs']} entretiens={ind['entretiens']} en_attente={ind['en_attente']} score={ind['score']}")
assert ind["candidatures"] >= 1 and ind["matchs"] >= 1 and ind["entretiens"] >= 1
assert any(o["id"] == offre_id for o in t["offres"])
assert len(t["series"]["candidatures"]) == 30
r = appel("GET", f"organisation/tableau/{offre_id}", token=t1)
csv = appel("GET", "organisation/tableau.csv", token=t1, brut=True)
assert "titre" in csv.splitlines()[0]

# ---------------------------------------------------------------- refus, retrait, garde-fous
ligne("garde-fous")
appel("PUT", f"candidatures/{cand2}/statut", {"statut": "acceptee"}, token=t1)
appel("PUT", f"candidatures/{cand_id}/statut", {"statut": "preselection"}, token=t1, attendu=403)   # pas son organisation
appel("PUT", f"candidatures/{cand_id}/statut", {"statut": "retiree"}, token=tc)
appel("POST", "organisation/rejoindre", {"code": "XXXXXXXXXXXX"}, token=t1, attendu=409)
appel("GET", "organisation/tableau", token=tc, attendu=403)
appel("GET", "profil", token=t1, attendu=403)
appel("POST", "auth/connexion", {"email": CAND, "motdepasse": "mauvais-mot-de-passe"}, attendu=401)
r = appel("POST", "auth/connexion", {"email": CAND, "motdepasse": MDP})
tc = r["jeton"]
appel("GET", "auth/sessions", token=tc)
r = appel("POST", "cles", {"nom": "recette"}, token=tc, attendu=201)
cle = r["cle"]["cle"]
appel("GET", "profil", token=cle)                                   # une clé d'API vaut une session
appel("POST", "cles", {"nom": "x"}, token=cle, attendu=403)
appel("DELETE", f"cles/{r['cle']['id']}", token=tc)
appel("GET", "profil", token=cle, attendu=401)
appel("GET", "openapi.json")
appel("GET", "auth/export", token=tc)

# ---------------------------------------------------------------- nettoyage (par sa propre session, jamais en masse)
ligne("nettoyage")
appel("DELETE", f"offres/{offre_id}", token=t1)
for tok in (tc, t1, t2):
    appel("DELETE", "auth/compte", token=tok)

print(f"\n{n} appels, {ecarts} écarts")
sys.exit(1 if ecarts else 0)
