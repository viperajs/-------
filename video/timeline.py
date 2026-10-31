"""Place the voice lines on a timeline and define shot cuts.

Reads build/vo/timings.json, writes build/timeline.json (used by the
renderer and by the audio mixer).
"""
import json, os

HERE = os.path.dirname(__file__)
T = {l["id"]: l for l in json.load(open(os.path.join(HERE, "build/vo/timings.json")))}

# (line id, gap in seconds after the previous line's last word)
ORDER = [("n1", 0.35), ("n2", 0.30), ("m1", 0.35), ("n3", 0.45),
         ("n4", 0.55), ("n5", 0.25), ("n6", 0.70), ("m2", 0.45)]

# words that get the red highlight instead of yellow
RED = {"seven", "kitchen", "dinner's", "ready", "buzzed", "mom", "midnight",
       "door", "cooking", "sweetie"}

lines, cursor = [], 0.0
for lid, gap in ORDER:
    l = T[lid]
    first = l["words"][0]["s"]
    start = cursor + gap - first          # absolute time the mp3 starts
    words = []
    for w in l["words"]:
        words.append({"w": w["w"], "s": round(start + w["s"], 3),
                      "e": round(start + w["e"], 3),
                      "red": w["w"].lower().strip(".,!?") in RED})
    lines.append({"id": lid, "start": round(start, 3), "words": words,
                  "end": words[-1]["e"]})
    cursor = words[-1]["e"]

L = {l["id"]: l for l in lines}
def w(lid, word):
    return next(x for x in L[lid]["words"] if x["w"].lower().startswith(word))

scare = round(L["m2"]["end"] + 0.55, 3)       # jumpscare hit
endcard = round(scare + 1.35, 3)
total = round(endcard + 3.6, 3)

shots = [
    {"name": "bedroom", "t": 0.0},
    {"name": "door", "t": L["n2"]["words"][0]["s"] - 0.05},
    {"name": "doorgap", "t": L["m1"]["words"][0]["s"] - 0.25},
    {"name": "stairs", "t": L["n3"]["words"][0]["s"] - 0.1},
    {"name": "phone", "t": L["n4"]["words"][0]["s"] - 0.15},
    {"name": "kitchen", "t": L["n6"]["words"][0]["s"] - 0.1},
    {"name": "turn", "t": L["m2"]["words"][0]["s"] - 0.2},
    {"name": "scare", "t": scare},
    {"name": "endcard", "t": endcard},
]
for s in shots:
    s["t"] = round(s["t"], 3)

marks = {
    "seven": w("n1", "seven")["s"],
    "buzz": w("n3", "buzzed")["s"],
    "notify": L["n4"]["words"][0]["s"] + 0.2,
    "circle": L["n5"]["words"][0]["s"],
    "scare": scare, "endcard": endcard, "total": total,
}

out = {"fps": 30, "total": total, "lines": lines, "shots": shots, "marks": marks}
json.dump(out, open(os.path.join(HERE, "build/timeline.json"), "w"), indent=1)
print(json.dumps({"shots": shots, "marks": marks}, indent=1))
