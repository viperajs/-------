"""Generate the voice-over lines with word-level timings (edge-tts).

Output: build/vo/<id>.mp3 and build/vo/timings.json
"""
import asyncio, json, os, sys
import edge_tts

OUT = os.path.join(os.path.dirname(__file__), "build", "vo")
PROXY = os.environ.get("HTTPS_PROXY")

NARRATOR = "en-US-AnaNeural"          # child narrator
THING = "en-US-JennyNeural"           # the "mom" in the kitchen

LINES = [
    ("n1", NARRATOR, "+0%", "+0Hz", "Every night at seven, my mom calls me down for dinner."),
    ("n2", NARRATOR, "+0%", "+0Hz", "Tonight, right on time, I heard her from the kitchen."),
    ("m1", THING, "-25%", "-18Hz", "Sweetie... dinner's ready!"),
    ("n3", NARRATOR, "+0%", "+0Hz", "I was halfway down the stairs, when my phone buzzed."),
    ("n4", NARRATOR, "-5%", "+0Hz", "It was a text from Mom."),
    ("n5", NARRATOR, "-10%", "-4Hz", "Stuck at work till midnight. Lock your door."),
    ("n6", NARRATOR, "-12%", "-6Hz", "So who's been cooking... in our kitchen?"),
    ("m2", THING, "-35%", "-30Hz", "Come and eat, sweetie."),
]


async def gen(lid, voice, rate, pitch, text):
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
    return {"id": lid, "text": text, "words": words}


async def main():
    os.makedirs(OUT, exist_ok=True)
    res = [await gen(*l) for l in LINES]
    with open(os.path.join(OUT, "timings.json"), "w") as f:
        json.dump(res, f, indent=1)
    for r in res:
        print(r["id"], [w["w"] for w in r["words"]])

asyncio.run(main())
