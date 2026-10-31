#!/usr/bin/env bash
# Full pipeline: voice -> timeline -> frames -> sound -> mp4
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
python3 tts.py          # needs network (edge-tts)
python3 timeline.py
node render.js          # build/frames/*.jpg  (headless Chromium + three.js)
python3 mix.py          # build/mix.wav
ffmpeg -v error -y -i build/mix.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 build/mix_norm.wav
mkdir -p out
ffmpeg -v error -y -framerate 30 -i build/frames/f%05d.jpg -i build/mix_norm.wav \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -movflags +faststart \
  -c:a aac -b:a 192k -shortest out/dinners-ready.mp4
echo "done -> out/dinners-ready.mp4"
