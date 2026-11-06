#!/usr/bin/env python3
"""Generate a tiny copyright-free Kevin Image Cloze fixture for CI."""
from pathlib import Path
import json
import sqlite3
import zipfile

root = Path("/tmp/m1racle-anki")
root.mkdir(parents=True, exist_ok=True)
dbfile = root / "fixture.sqlite"
if dbfile.exists():
    dbfile.unlink()
db = sqlite3.connect(dbfile)
db.execute("CREATE TABLE col (models TEXT, decks TEXT)")
db.execute("CREATE TABLE notes (id INTEGER, mid INTEGER, flds TEXT)")
db.execute("CREATE TABLE cards (id INTEGER, nid INTEGER, did INTEGER, ord INTEGER)")
fields = ["ID", "Header", "Image", "Masks", "Source", "Notes", "Mode", "Index"]
model = {"101": {
    "name": "Kevin Image Cloze",
    "flds": [{"name": label} for label in fields],
    "tmpls": [{"name": "Kevin Card", "qfmt": "{{Image}}", "afmt": "{{FrontSide}}"}],
}}
decks = {"1": {"name": "Medicine::Physiology"}}
db.execute("INSERT INTO col VALUES (?, ?)", (json.dumps(model), json.dumps(decks)))
for cid in (1, 2):
    mask = [[[0.10, 0.17, 0.25, 0.12], [0.42, 0.48, 0.31, 0.13]]]
    raw = "\x1f".join([
        f"D:{cid:014}", "", '<img src="fixture.svg">',
        json.dumps(mask), "", "", "free_guess", "0"
    ])
    db.execute("INSERT INTO notes VALUES (?, ?, ?)", (cid, 101, raw))
    db.execute("INSERT INTO cards VALUES (?, ?, ?, ?)", (cid, cid, 1, 0))
db.commit()
db.close()
svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300">'
       '<rect width="400" height="300" fill="white"/>'
       '<text x="60" y="70" font-size="20">CIRCULATION</text>'
       '<text x="180" y="170" font-size="20">CARDIAC OUTPUT</text></svg>')
dest = root / "kevin-fixture.apkg"
with zipfile.ZipFile(dest, "w", compression=zipfile.ZIP_DEFLATED) as z:
    z.write(dbfile, "collection.anki2")
    z.writestr("media", json.dumps({"0": "fixture.svg"}))
    z.writestr("0", svg)
print("Generated", dest, dest.stat().st_size)
