# -*- coding: utf-8 -*-
"""Recette de l'API, de bout en bout : catalogue public, compte candidat,
   profil, CV, deck score, candidature, retrait, cles d'API, export, suppression.

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
r = appel("POST", "auth/inscription", {"email": CAND, "motdepasse": MDP}, attendu=201)
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
appel("DELETE", f"swipes/{deck[-1]['id']}", token=tc)

# ---------------------------------------------------------------- refus, retrait, garde-fous
ligne("garde-fous")
# Le retrait est le seul changement de statut qu'un candidat peut demander.
appel("PUT", f"candidatures/{cand_id}/statut", {"statut": "preselection"}, token=tc, attendu=422)
appel("PUT", f"candidatures/{cand_id}/statut", {"statut": "retiree"}, token=tc)
appel("GET", "candidatures/999999999", token=tc, attendu=404)
appel("GET", "profil", attendu=401)
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
appel("DELETE", "auth/compte", token=tc)

print(f"\n{n} appels, {ecarts} écarts")
sys.exit(1 if ecarts else 0)
