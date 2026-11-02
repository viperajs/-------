#!/usr/bin/env bash
# Full pipeline for one episode: voice -> timeline -> frames -> sound -> mp4
#   ./build.sh ep1   (Dinner's Ready)
#   ./build.sh ep2   (The Babysitter)
set -euo pipefail
cd "$(dirname "$0")"
EP="${1:-ep2}"
B="build/$EP"
[ -d node_modules ] || npm install
python3 tts.py "$EP"          # needs network (edge-tts)
python3 timeline.py "$EP"
node render.js --ep "$EP"     # $B/frames/*.jpg  (headless Chromium + three.js)
python3 mix.py "$EP"          # $B/mix.wav
ffmpeg -v error -y -i "$B/mix.wav" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 "$B/mix_norm.wav"
OUT="out/$(python3 -c "import json;print(json.load(open('$B/timeline.json'))['out'])")"
mkdir -p out
ffmpeg -v error -y -framerate 30 -i "$B/frames/f%05d.jpg" -i "$B/mix_norm.wav" \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -shortest "$OUT"
echo "done -> $OUT"
