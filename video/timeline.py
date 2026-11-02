"""Place an episode's voice lines on a timeline and define shot cuts.

Usage: python3 timeline.py ep2  ->  build/ep2/timeline.json
(used by render.js and mix.py)
"""
import json, os, sys
from episodes import EPISODES

EP = sys.argv[1] if len(sys.argv) > 1 else "ep2"
CFG = EPISODES[EP]
HERE = os.path.dirname(os.path.abspath(__file__))
B = os.path.join(HERE, "build", EP)
T = {l["id"]: l for l in json.load(open(os.path.join(B, "vo/timings.json")))}

lines, cursor = [], 0.0
for lid, *_, fx in CFG["lines"]:
    l = T[lid]
    start = cursor + CFG["gaps"][lid] - l["words"][0]["s"]   # absolute time the mp3 starts
    words = [{"w": w["w"], "s": round(start + w["s"], 3), "e": round(start + w["e"], 3),
              "red": w["w"].lower().strip(".,!?") in CFG["red"]} for w in l["words"]]
    lines.append({"id": lid, "fx": fx, "start": round(start, 3), "words": words,
                  "end": words[-1]["e"]})
    cursor = words[-1]["e"]

L = {l["id"]: l for l in lines}
def w(lid, word):
    return next(x for x in L[lid]["words"] if x["w"].lower().startswith(word))

shots, marks = CFG["shots"](L, w)
shots = [{"name": n, "t": round(t, 3)} for n, t in shots]
marks = {k: round(v, 3) for k, v in marks.items()}

out = {"ep": EP, "fps": 30, "total": marks["total"], "lines": lines, "shots": shots,
       "marks": marks, "text": CFG["text"], "out": CFG["out"]}
json.dump(out, open(os.path.join(B, "timeline.json"), "w"), indent=1, ensure_ascii=False)
print(json.dumps({"shots": shots, "marks": marks}, indent=1))
