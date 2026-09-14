# -*- coding: utf-8 -*-
"""Fait tourner l'extraction reelle (le fichier servi) sur un vrai CV.
   Les spans PyMuPDF tiennent lieu d'items pdf.js : meme forme, memes coordonnees."""
import json, pathlib, subprocess, sys, tempfile
import fitz

sys.stdout.reconfigure(encoding="utf-8")
CV = sys.argv[1]                                  # python essai_cv.py mon_cv.pdf
APP = pathlib.Path(__file__).resolve().parent / "../prototype/assets/extraction.js"

pages = []
doc = fitz.open(CV)
for page in doc:
    h = page.rect.height
    items = []
    for bloc in page.get_text("dict")["blocks"]:
        for ligne in bloc.get("lines", []):
            for sp in ligne["spans"]:
                x0, y0, x1, y1 = sp["bbox"]
                items.append({
                    "str": sp["text"],
                    "transform": [0, 0, 0, 0, x0, h - y1],   # pdf.js compte depuis le bas
                    "width": x1 - x0,
                })
    pages.append({"items": items, "largeur": page.rect.width, "hauteur": h})

src = APP.read_text(encoding="utf-8")
src = src.replace("  window.AJ_EXTRACTION = {",
                  "  module.exports = { analyse: analyse, lignesDePage: lignesDePage, coupure: coupure };\n  window.AJ_EXTRACTION = {")

tmp = pathlib.Path(tempfile.gettempdir()) / "extraction_test.js"
tmp.write_text("global.window = {}; global.document = { createElement: function(){return {};}, head:{appendChild:function(){}} };\n" + src, encoding="utf-8")

pilote = pathlib.Path(tempfile.gettempdir()) / "pilote.js"
pilote.write_text("""
var E = require(%s);
var pages = JSON.parse(require('fs').readFileSync(process.argv[process.argv.length - 1], 'utf8'));
var lignes = [], entete = null;
pages.forEach(function (p) {
  var r = E.lignesDePage({ items: p.items }, p.largeur, p.hauteur);
  if (entete === null) entete = r.entete;
  lignes = lignes.concat(r.lignes);
});
console.log('--- entete : ' + JSON.stringify(entete));
console.log('--- lignes (' + lignes.length + ')');
lignes.forEach(function (l, i) { console.log('  ' + i + '  ' + l); });
var a = E.analyse(lignes, entete);
console.log('--- trouve');
Object.keys(a.trouve).forEach(function (k) {
  console.log('  ' + k + ' = ' + JSON.stringify(a.trouve[k]));
  console.log('      source : ' + a.sources[k]);
});
""" % json.dumps(str(tmp).replace("\\", "/")), encoding="utf-8")

data = pathlib.Path(tempfile.gettempdir()) / "pages.json"
data.write_text(json.dumps(pages), encoding="utf-8")
print(subprocess.run(["node", str(pilote), "x", str(data)], capture_output=True, text=True,
                     encoding="utf-8").stdout)
