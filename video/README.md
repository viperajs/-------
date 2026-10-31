# "Dinner's Ready" — horror Short (9:16, 1080×1920, 30 fps, 14.4 s)

An original two-sentence-horror Short made in the same edit style as the
reference ("Would you look under the bed?"): clay-look 3D cartoon characters,
a dark cozy house, a persistent hook title at the top, word-by-word captions,
a red circle with an arrow on the key detail, a jumpscare, and a "thumbnail"
end card.

**Final video:** [`out/dinners-ready.mp4`](out/dinners-ready.mp4)

## Story

> Mom called me down for dinner — *"Sweetie... dinner's ready!"*
> Then my phone buzzed. Mom: **"Stuck at work till midnight."**
> So who's in the kitchen?

## Edit style used (copied from the reference)

| Element | How it's done here |
|---|---|
| Hook title, top, the whole video | `MOM CALLED ME DOWN` (white) / `FOR DINNER... 😨` (red), heavy uppercase Montserrat 900 |
| Captions | One word at a time, centre-low, yellow; key words in red; pop-in scale on every word |
| Visual look | Clay-style 3D (rounded shapes, big glossy black eyes, matte bumpy materials), dark blue night and warm lamp light, vignette, film grain |
| Camera | A quick zoom-in punch on every cut, slow push-ins, shake on the scare |
| Highlight | Red circle drawn in with an arrow (phone message, then the reflection in the girl's eye) |
| Climax | Silence, then a red-flash jumpscare with a stinger |
| End card | Top quote + bottom 3-line summary: `MOM WAS STILL / AT WORK 😱 / SO WHO'S IN THE KITCHEN? 💀` |

## Shot list

| # | Time | Shot |
|---|---|---|
| 1 | 0.0 s | Bedroom, girl in bed, clock ticks to 7:00 |
| 2 | 1.2 s | Door to the hallway creaks open, she turns to look |
| 3 | 2.2 s | Light through the door gap, a tall shadow passes ("Sweetie... dinner's ready!") |
| 4 | 4.3 s | Low angle on the stairs, she walks down, the phone buzzes |
| 5 | 5.7 s | Phone close-up, Mom's text slides in, red circle + arrow |
| 6 | 8.7 s | Peeking into the kitchen: a too-tall figure stirring a pot |
| 7 | 9.5 s | Its head turns all the way around in stutters |
| 8 | 11.0 s | Jumpscare |
| 9 | 12.0 s | End card: girl's terrified face, the grin reflected in her eye |

## Rebuild

Requirements: Node 18+, Python 3 with `numpy` + `edge-tts`, `ffmpeg`, Playwright Chromium.

```bash
cd video
./build.sh
```

| File | Role |
|---|---|
| `tts.py` | Generates the voice lines (edge-tts) with word timings |
| `timeline.py` | Places the lines, defines shot cuts and marks → `build/timeline.json` |
| `scene.html` / `scene.js` | three.js scenes + caption overlay; `renderFrame(t)` is deterministic |
| `render.js` | Captures every frame with headless Chromium |
| `mix.py` | Sound design (all synthesized) + voice mix |
| `build.sh` | Runs everything and encodes the mp4 |

To change the story, edit `LINES` in `tts.py`, the red-word list in `timeline.py`, and the title and end-card text in `scene.html`.
To preview single frames: `node render.js --stills 2,12,30` → `build/stills/`.
