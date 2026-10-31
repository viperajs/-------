"""Sound design + voice-over mix -> build/mix.wav (48 kHz stereo).

Everything except the voices is synthesized here with numpy, so the
project has no third-party audio assets.
"""
import json, os, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TL = json.load(open(os.path.join(HERE, "build/timeline.json")))
M, total = TL["marks"], TL["total"]
N = int(total * SR) + SR
out = np.zeros((N, 2))
rs = np.random.default_rng(42)
shot = {s["name"]: s["t"] for s in TL["shots"]}


def place(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    sig = sig[: max(0, N - i)]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:i + len(sig), 0] += sig * gain * l * 1.414
    out[i:i + len(sig), 1] += sig * gain * r * 1.414


def tt(d):
    return np.arange(int(d * SR)) / SR


def env(d, a=0.005, rel=None):
    t = tt(d)
    e = np.minimum(1, t / a)
    if rel:
        e *= np.exp(-t / rel)
    return e




def lp(x, cutoff):
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    # vectorised one-pole via lfilter-free recursion (scipy not needed): use FFT filtering
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def hp(x, cutoff):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1e-3)) ** 4)
    return np.fft.irfft(X, len(x))


def reverb(x, dur=1.6, wet=0.35, tone=3000):
    ir = rs.standard_normal(int(dur * SR)) * np.exp(-tt(dur) / (dur / 5))
    ir = lp(ir, tone)
    ir /= np.sqrt(np.sum(ir ** 2))
    n = len(x) + len(ir)
    y = np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)
    return np.concatenate([x, np.zeros(len(ir))]) * (1 - wet) + y * wet * 1.5


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


# ------------------------------------------------------------- voices
for l in TL["lines"]:
    v = load(os.path.join(HERE, "build/vo", l["id"] + ".mp3"))
    if l["id"] == "m1":        # heard from downstairs: muffled + roomy
        v = reverb(lp(v, 1800), 1.8, 0.55, 2000)
        place(v, l["start"], 0.9, 0.25)
    elif l["id"] == "m2":      # whisper right in front of you, doubled an octave-ish lower
        low = load(os.path.join(HERE, "build/vo", "m2.mp3"))
        idx = np.arange(0, len(low), 0.8)
        low = np.interp(idx, np.arange(len(low)), low)
        v2 = np.zeros(max(len(v), len(low)))
        v2[:len(v)] += v
        v2[:len(low)] += low * 0.55
        place(reverb(v2, 1.0, 0.3), l["start"], 1.0)
    else:
        place(reverb(v, 0.6, 0.12, 5000), l["start"], 1.0)

# ------------------------------------------------------------- drone bed
t = np.arange(N) / SR
rise = np.clip(t / M["scare"], 0, 1) ** 1.5
drone = (np.sin(2 * np.pi * 55 * t) * 0.5 + np.sin(2 * np.pi * 58.3 * t) * 0.35 +
         np.sin(2 * np.pi * 82.4 * t + np.sin(t * 0.7)) * 0.25 + np.sin(2 * np.pi * 116.5 * t) * 0.12 * rise)
drone *= 0.55 + 0.25 * np.sin(2 * np.pi * 0.13 * t)
noise = lp(rs.standard_normal(N), 260) * 2.2
bed = (drone * 0.11 + noise * 0.06) * (0.6 + 0.9 * rise)
# silence drop just before the scare, then back for the end card
gate = np.ones(N)
gate[(t > M["scare"] - 0.55) & (t < M["endcard"])] = 0.0
gate = np.convolve(gate, np.ones(1200) / 1200, mode="same")
bed *= gate
out[:, 0] += bed
out[:, 1] += bed * 0.97

# ------------------------------------------------------------- sfx
def tick():
    d = 0.04
    return hp(rs.standard_normal(int(d * SR)), 2500) * env(d, 0.0005, 0.006)


for k in np.arange(0.2, shot["door"], 1.0):
    place(tick(), k, 0.35, -0.3)
# soft chime when the clock hits seven
c = tt(2.5)
chime = (np.sin(2 * np.pi * 784 * c) + 0.5 * np.sin(2 * np.pi * 1176 * c) + 0.3 * np.sin(2 * np.pi * 1568 * c)) * env(2.5, 0.003, 0.6)
place(chime, M["seven"], 0.10, -0.3)


def whoosh(d=0.6, peak=0.65):
    x = rs.standard_normal(int(d * SR))
    e = np.sin(np.pi * np.clip(tt(d) / d, 0, 1)) ** 2
    e = np.where(tt(d) < d * peak, (tt(d) / (d * peak)) ** 2, np.exp(-(tt(d) - d * peak) / 0.06))
    return lp(hp(x, 300), 2500) * e


for s in TL["shots"][1:]:
    if s["name"] not in ("scare", "endcard"):
        place(whoosh(), s["t"] - 0.42, 0.22)


def creak(d=1.3):
    c = tt(d)
    rate = 35 + 25 * np.sin(c * 3.1) + 12 * np.sin(c * 11)
    ph = np.cumsum(rate) / SR
    pulses = (np.sin(2 * np.pi * ph) > 0.97).astype(float)
    body = np.convolve(pulses, np.sin(2 * np.pi * 900 * tt(0.01)) * np.exp(-tt(0.01) / 0.003), mode="same")
    return hp(body, 400) * np.sin(np.pi * c / d)


place(creak(), shot["door"] + 0.1, 0.5, 0.4)


def thump(f=70, d=0.25, click=True):
    c = tt(d)
    s = np.sin(2 * np.pi * f * c * (1 - 0.3 * c / d)) * env(d, 0.002, 0.06)
    if click:
        s += lp(rs.standard_normal(len(c)), 1500) * env(d, 0.001, 0.01) * 0.6
    return s


# footsteps on the stairs (match the walk in the render)
walk_end = M["buzz"] - 0.1
for k in (1, 2, 3):
    place(thump(90, 0.3), shot["stairs"] + (walk_end - shot["stairs"]) * k / 3 - 0.08, 0.5)

# phone buzz x2 + notification ping
for k in (0, 0.55):
    c = tt(0.38)
    bz = np.sign(np.sin(2 * np.pi * 165 * c)) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * c))
    place(lp(bz, 1200) * env(0.38, 0.01) * (c < 0.34), M["buzz"] + k, 0.22)
c = tt(1.2)
ping = (np.sin(2 * np.pi * 1568 * c) * env(1.2, 0.002, 0.18) + np.sin(2 * np.pi * 2093 * c) * env(1.2, 0.002, 0.25) *
        (c > 0.12))
place(ping, M["notify"], 0.16)
# red circle "hit"
place(thump(55, 0.6, False) + lp(rs.standard_normal(int(0.6 * SR)), 800) * env(0.6, 0.001, 0.08), M["circle"], 0.5)

# kitchen: stove sizzle + heartbeat that speeds up
k0, k1 = shot["kitchen"], M["scare"] - 0.55
sz = hp(rs.standard_normal(int((k1 - k0) * SR)), 3000) * 0.04
sz *= 0.7 + 0.3 * np.sin(tt(k1 - k0) * 9) * np.sin(tt(k1 - k0) * 2.3)
place(sz, k0, 0.5, 0.2)
beat_t = k0
while beat_t < k1:
    place(thump(48, 0.22, False), beat_t, 0.8)
    place(thump(44, 0.22, False), beat_t + 0.17, 0.6)
    frac = (beat_t - k0) / (k1 - k0)
    beat_t += 0.95 - 0.45 * frac

# ------------------------------------------------------------- jumpscare
d = 1.5
c = tt(d)
e = np.minimum(1, c / 0.004) * np.exp(-c / 0.7)
cluster = sum(np.sign(np.sin(2 * np.pi * f * c + rs.random() * 6)) for f in (311, 329, 349, 466, 493, 622))
glide = 700 + 900 * (1 - np.exp(-c * 5))
scream_ph = np.cumsum(glide * (1 + 0.04 * np.sin(2 * np.pi * 9 * c))) / SR
scream = sum(np.sin(2 * np.pi * scream_ph * h) / h for h in (1, 2, 3, 4, 5))
burst = rs.standard_normal(len(c))
sting = lp(cluster * 0.25 + scream * 0.6 + burst * 0.5, 6000) * e + thump(40, d, False) * 1.4
place(sting, M["scare"], 0.75)
place(sting * 0.6, M["scare"] + 0.012, 0.75, 0.6)

# end card: boom + ringing
c = tt(3.5)
place(thump(38, 3.5, False) * 1.2 + np.sin(2 * np.pi * 2637 * c) * env(3.5, 0.01, 1.2) * 0.12, M["endcard"], 1.3)

# ------------------------------------------------------------- master
out = out[: int(total * SR)]
fade = np.ones(len(out))
fade[-int(0.6 * SR):] = np.linspace(1, 0, int(0.6 * SR))
out *= fade[:, None]
out /= np.max(np.abs(out)) / 1.1
out = np.tanh(out * 1.15) * 0.92          # soft limiter
pcm = (out * 32767).astype(np.int16)
import wave
with wave.open(os.path.join(HERE, "build/mix.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("mix.wav", len(out) / SR, "s")
