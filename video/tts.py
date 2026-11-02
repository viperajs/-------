"""Generate an episode's voice lines with word-level timings (edge-tts).

Usage: python3 tts.py ep2   ->  build/ep2/vo/<id>.mp3 + timings.json
"""
import asyncio, json, os, sys
import edge_tts
from episodes import EPISODES

EP = sys.argv[1] if len(sys.argv) > 1 else "ep2"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "build", EP, "vo")
PROXY = os.environ.get("HTTPS_PROXY")


async def gen(lid, voice, rate, pitch, text, fx):
    com = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, proxy=PROXY,
                               boundary="WordBoundary")
    words, audio = [], bytearray()
    async for chunk in com.stream():
        if chunk["type"] == "audio":
            audio += chunk["data"]
        elif chunk["type"] == "WordBoundary":
            words.append({"w": chunk["text"],
                          "s": chunk["offset"] / 1e7,
                          "e": (chunk["offset"] + chunk["duration"]) / 1e7})
    with open(os.path.join(OUT, f"{lid}.mp3"), "wb") as f:
        f.write(audio)
    return {"id": lid, "text": text, "fx": fx, "words": words}


async def main():
    os.makedirs(OUT, exist_ok=True)
    res = [await gen(*l) for l in EPISODES[EP]["lines"]]
    with open(os.path.join(OUT, "timings.json"), "w") as f:
        json.dump(res, f, indent=1)
    for r in res:
        print(r["id"], [w["w"] for w in r["words"]])

asyncio.run(main())
