# -*- coding: utf-8 -*-
"""Passe tout un dossier de CV dans l'extraction reellement servie.
   Sortie compacte : ce qui est trouve, ce qui manque, et les indices de doute."""
import json, os, pathlib, subprocess, sys, tempfile
import fitz

sys.stdout.reconfigure(encoding="utf-8")
DOSSIER = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else os.environ.get("AVP_CV_DIR", "cv"))
APP = pathlib.Path(__file__).resolve().parent / "../prototype/assets/extraction.js"
TMP = pathlib.Path(tempfile.gettempdir())

src = APP.read_text(encoding="utf-8").replace(
    "  window.AJ_EXTRACTION = {",
    "  module.exports = { analyse: analyse, lignesDePage: lignesDePage };\n  window.AJ_EXTRACTION = {")
(TMP / "extr.js").write_text(
    "global.window = {}; global.document = { createElement: function(){return {};}, "
    "head:{appendChild:function(){}} };\n" + src, encoding="utf-8")

(TMP / "run.js").write_text("""
var E = require(%s);
var pages = JSON.parse(require('fs').readFileSync(process.argv[process.argv.length - 1], 'utf8'));
var lignes = [], entete = null;
pages.forEach(function (p) {
  var r = E.lignesDePage({ items: p.items }, p.largeur, p.hauteur);
  if (entete === null) entete = r.entete;
  lignes = lignes.concat(r.lignes);
});
var a = E.analyse(lignes, entete);
console.log(JSON.stringify({ trouve: a.trouve, sources: a.sources, lignes: lignes, entete: entete }));
""" % json.dumps(str(TMP / "extr.js").replace("\\", "/")), encoding="utf-8")


def spans(pdf):
    pages = []
    doc = fitz.open(pdf)
    for page in doc:
        h = page.rect.height
        items = []
        for bloc in page.get_text("dict")["blocks"]:
            for ligne in bloc.get("lines", []):
                for sp in ligne["spans"]:
                    x0, y0, x1, y1 = sp["bbox"]
                    items.append({"str": sp["text"], "transform": [0, 0, 0, 0, x0, h - y1],
                                  "width": x1 - x0, "height": sp["size"]})
        pages.append({"items": items, "largeur": page.rect.width, "hauteur": h})
    return pages, doc.page_count


ATTENDU = ["prenom", "initiale", "email", "telephone", "formation",
           "experiences", "formations", "competences", "langues", "permis"]

for f in sorted(DOSSIER.glob("*.pdf")):
    pages, n = spans(f)
    (TMP / "pages.json").write_text(json.dumps(pages), encoding="utf-8")
    r = subprocess.run(["node", str(TMP / "run.js"), str(TMP / "pages.json")],
                       capture_output=True, text=True, encoding="utf-8")
    if r.returncode:
        print("\n### %s\n  ERREUR : %s" % (f.name, r.stderr.strip().splitlines()[-1] if r.stderr else "?"))
        continue
    d = json.loads(r.stdout)
    t = d["trouve"]
    print("\n### %s  (%d page(s), %d lignes)" % (f.name, n, len(d["lignes"])))
    print("  entête     : %s" % " | ".join(d["entete"]))
    print("  identité   : %s %s. | %s | %s" % (
        t.get("prenom", "—"), t.get("initiale", "—"),
        t.get("email", "—"), t.get("telephone", "—")))
    print("  niveau     : %s" % t.get("formation", "—"))
    for x in t.get("experiences", []):
        print("  expérience : %-46s %s → %s" % (x["poste"][:46], x["debut"] or "?", x["fin"] or "…"))
    if not t.get("experiences"):
        print("  expérience : AUCUNE")
    for x in t.get("formations", []):
        print("  formation  : %-46s niveau %s" % (x["domaine"][:46], x["niveau"]))
    if not t.get("formations"):
        print("  formation  : AUCUNE")
    print("  compétences: %s" % (" · ".join(t.get("competences", [])) or "AUCUNE"))
    print("  langues    : %s" % (" · ".join("%s %s" % (l["langue"], l["niveau"])
                                            for l in t.get("langues", [])) or "aucune"))
    manque = [c for c in ATTENDU if c not in t]
    print("  non trouvé : %s" % (", ".join(manque) or "rien"))
