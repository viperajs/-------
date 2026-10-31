// "Dinner's Ready" - frame-by-frame renderer.
// window.setup(timeline) then window.renderFrame(t) for every frame.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const W = 1080, H = 1920;
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// ---------------------------------------------------------------- helpers
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeOut = k => 1 - Math.pow(1 - clamp(k), 3);
const easeInOut = k => { k = clamp(k); return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const shake = (t, a) => new THREE.Vector3(
  a * (Math.sin(t * 37.1) * .6 + Math.sin(t * 91.7 + 1.3) * .4),
  a * (Math.sin(t * 43.3 + 2.1) * .6 + Math.sin(t * 77.9 + .4) * .4),
  0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const tx = new THREE.CanvasTexture(c);
  tx.colorSpace = THREE.SRGBColorSpace;
  tx.anisotropy = 8;
  if (opts.repeat) { tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(...opts.repeat); }
  tx.userData = { canvas: c, ctx: g };
  return tx;
}

// subtle lumpy "clay" bump
const clayBump = canvasTex(256, 256, (g, w, h) => {
  const r = rng(7); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    const v = 110 + r() * 40 | 0; g.fillStyle = `rgba(${v},${v},${v},.35)`;
    g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 9, 0, Math.PI * 2); g.fill();
  }
}, { repeat: [2, 2] });
clayBump.colorSpace = THREE.NoColorSpace;

const clay = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: .78, metalness: 0,
  bumpMap: clayBump, bumpScale: .6, ...o });
const gloss = color => new THREE.MeshPhysicalMaterial({ color, roughness: .12, clearcoat: 1, clearcoatRoughness: .05 });
const glow = color => new THREE.MeshBasicMaterial({ color, toneMapped: false });

function mesh(geo, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}
const box = (w, h, d, mat, x, y, z, p) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, p);
const rbox = (w, h, d, r, mat, x, y, z, p) => mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat, x, y, z, p);
const sph = (r, mat, x, y, z, p, seg = 32) => mesh(new THREE.SphereGeometry(r, seg, seg * 3 / 4 | 0), mat, x, y, z, p);
const cap = (r, l, mat, x, y, z, p) => mesh(new THREE.CapsuleGeometry(r, l, 8, 20), mat, x, y, z, p);
const cyl = (rt, rb, h, mat, x, y, z, p, seg = 28) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, p);

// ---------------------------------------------------------------- textures
const checker = (a, b, n) => canvasTex(512, 512, (g, w) => {
  const s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); } });

const starWall = (bg, rep) => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); const r = rng(3);
  const star = (x, y, s) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2,
    rr = i % 2 ? s * .45 : s; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); };
  for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(232,208,120,.55)'; star(r() * w, r() * h, 9 + r() * 10); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(200,210,255,.25)'; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 3, 0, 7); g.fill(); }
}, { repeat: rep });

const planks = (c1, rep) => canvasTex(512, 512, (g, w, h) => {
  const r = rng(11); const n = 6;
  for (let i = 0; i < n; i++) { const k = .85 + r() * .3; const col = new THREE.Color(c1).multiplyScalar(k);
    g.fillStyle = '#' + col.getHexString(); g.fillRect(0, i * h / n, w, h / n);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * h / n, w, 3);
    g.fillRect(r() * w, i * h / n, 3, h / n); }
}, { repeat: rep });

const tiles = (c1, c2, rep) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = c2; g.fillRect(0, 0, w, h); g.fillStyle = c1;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g.fillRect(i * 64 + 3, j * 64 + 3, 58, 58);
}, { repeat: rep });

const radial = (inner, outer = 'rgba(0,0,0,0)') => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer); g.fillStyle = gr; g.fillRect(0, 0, w, w); });

// the thing's grin - also reused as the tiny reflection in the girl's eye
function drawGrin(g, w, h) {
  g.clearRect(0, 0, w, h);
  // hollow eyes
  for (const sx of [-1, 1]) {
    g.fillStyle = '#050505'; g.beginPath(); g.ellipse(w / 2 + sx * w * .17, h * .33, w * .085, h * .115, sx * .25, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(w / 2 + sx * w * .16, h * .345, w * .012, 0, 7); g.fill();
  }
  // huge grin
  const cx = w / 2, cy = h * .55;
  g.save(); g.beginPath();
  g.moveTo(cx - w * .38, cy - h * .06);
  g.quadraticCurveTo(cx, cy + h * .08, cx + w * .38, cy - h * .06);
  g.quadraticCurveTo(cx + w * .3, cy + h * .26, cx, cy + h * .28);
  g.quadraticCurveTo(cx - w * .3, cy + h * .26, cx - w * .38, cy - h * .06);
  g.closePath(); g.fillStyle = '#2a0006'; g.fill(); g.clip();
  g.fillStyle = '#efe7cf'; g.strokeStyle = '#3a1a10'; g.lineWidth = w * .006;
  for (let i = -7; i <= 7; i++) { // top teeth
    const x = cx + i * w * .05; const y = cy - h * .06 + Math.pow(Math.abs(i) / 7, 2) * -h * .0 + (1 - Math.pow(i / 7, 2)) * h * .07;
    g.beginPath(); g.moveTo(x - w * .024, y - h * .05); g.lineTo(x + w * .024, y - h * .05); g.lineTo(x + w * .016, y + h * .045);
    g.lineTo(x - w * .016, y + h * .045); g.closePath(); g.fill(); g.stroke();
  }
  for (let i = -6; i <= 6; i++) { // bottom teeth
    const x = cx + i * w * .05; const y = cy + h * .27 - Math.pow(i / 6, 2) * h * .12;
    g.beginPath(); g.moveTo(x - w * .022, y + h * .05); g.lineTo(x + w * .022, y + h * .05); g.lineTo(x + w * .014, y - h * .045);
    g.lineTo(x - w * .014, y - h * .045); g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
  g.strokeStyle = '#1a0003'; g.lineWidth = w * .012; g.beginPath();
  g.moveTo(cx - w * .38, cy - h * .06); g.quadraticCurveTo(cx - w * .43, cy - h * .1, cx - w * .44, cy - h * .14);
  g.moveTo(cx + w * .38, cy - h * .06); g.quadraticCurveTo(cx + w * .43, cy - h * .1, cx + w * .44, cy - h * .14); g.stroke();
}
const grinTex = canvasTex(1024, 1024, drawGrin);

// ---------------------------------------------------------------- characters
function makeGirl() {
  const g = new THREE.Group();
  const skin = clay(0xf2cfae), pj = clay(0xf2bf3f), pjDot = clay(0xfff1c4), hairM = clay(0x4a2716, { roughness: .7 });
  const black = gloss(0x060606), white = glow(0xffffff), mouthM = clay(0x3b0a0c), tie = clay(0xd8263a);
  cap(.62, .75, pj, 0, 1.2, 0, g);                      // body
  for (const [x, y, z] of [[-.3, 1.5, .55], [.25, 1.15, .6], [-.1, .9, .58], [.35, 1.6, .45]]) sph(.07, pjDot, x, y, z, g, 12);
  const legs = []; for (const sx of [-1, 1]) legs.push(cap(.21, .55, pj, sx * .28, .38, 0, g));
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * .64, 1.62, 0); g.add(a);
    cap(.17, .62, pj, 0, -.42, 0, a); sph(.2, skin, 0, -.86, 0, a);
    a.rotation.z = sx * .18; arms.push(a);
  }
  const head = new THREE.Group(); head.position.set(0, 1.95, 0); g.add(head);
  const hm = sph(1, skin, 0, .95, 0, head, 48); hm.scale.set(1.06, .96, 1);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); e.position.set(sx * .36, 1.02, .86); head.add(e);
    const ball = sph(.26, black, 0, 0, 0, e); ball.scale.set(1, 1.18, .5);
    sph(.075, white, .08, .11, .12, e, 12); sph(.035, white, -.07, -.08, .13, e, 10);
    eyes.push(e);
  }
  const brows = [];
  for (const sx of [-1, 1]) { const b = cap(.045, .22, hairM, sx * .37, 1.42, .86, head); b.rotation.z = Math.PI / 2 + sx * .2; brows.push(b); }
  sph(.12, clay(0xf0a98d), 0, .8, .98, head, 16);                         // nose
  for (const sx of [-1, 1]) { const c = sph(.13, clay(0xf3a2a0), sx * .62, .7, .72, head, 12); c.scale.set(1, .6, .3); } // cheeks
  const mouth = sph(.15, mouthM, 0, .47, .88, head, 20); mouth.scale.set(1, .5, .4);
  // hair cap + bangs + pigtails
  const capM = new THREE.Mesh(new THREE.SphereGeometry(1.1, 48, 24, 0, Math.PI * 2, 0, Math.PI * .52), hairM);
  capM.position.set(0, .98, -.05); capM.rotation.x = -.42; capM.scale.set(1.04, 1, 1); capM.castShadow = true; head.add(capM);
  for (const [x, rz] of [[-.45, .5], [0, 0], [.45, -.5]]) { const b = sph(.42, hairM, x, 1.62, .62, head); b.scale.set(1, .55, .5); b.rotation.z = rz; }
  for (const sx of [-1, 1]) { const p = sph(.42, hairM, sx * 1.12, .95, -.25, head); p.scale.set(.8, 1.15, .8);
    const t = mesh(new THREE.TorusGeometry(.17, .07, 10, 20), tie, sx * .93, 1.15, -.2, head); t.rotation.y = Math.PI / 2; }
  // tiny reflection of the grin in her left eye (used on the end card)
  const refl = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), new THREE.MeshBasicMaterial({ map: grinTex, transparent: true,
    toneMapped: false, opacity: 0, depthWrite: false }));
  refl.position.set(0, -.02, .135); eyes[1].add(refl);
  g.userData = { head, arms, legs, eyes, brows, mouth, refl };
  return g;
}

function makeThing({ silhouette = false } = {}) {
  const g = new THREE.Group();
  const dress = silhouette ? clay(0x020202) : clay(0x4b1a22), skin = silhouette ? clay(0x020202) : clay(0xc9cbc4, { roughness: .9 });
  const hairM = silhouette ? clay(0x020202) : clay(0x0a0909, { roughness: .95 }), apron = clay(0xe8e0cc);
  cyl(.55, 1.05, 3.4, dress, 0, 1.7, 0, g);              // dress
  sph(.58, dress, 0, 3.42, 0, g);                         // shoulders
  if (!silhouette) { const bowL = sph(.2, apron, -.18, 2.6, -.55, g); bowL.scale.set(1, .6, .4);
    const bowR = sph(.2, apron, .18, 2.6, -.55, g); bowR.scale.set(1, .6, .4); box(1.6, .08, .06, apron, 0, 2.6, -.52, g).visible = false; }
  const arms = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(sx * .55, 3.5, 0); g.add(a);
    cap(.12, 2.3, dress, 0, -1.25, 0, a); const h = sph(.17, skin, 0, -2.55, 0, a); h.scale.set(.8, 1.4, .8);
    for (let f = -1; f <= 1; f++) cap(.035, .35, skin, f * .06, -2.85, .02, a);
    a.rotation.z = sx * .08; arms.push(a);
  }
  cyl(.13, .16, .6, skin, 0, 3.85, 0, g);                 // long neck
  const head = new THREE.Group(); head.position.set(0, 4.05, 0); g.add(head);
  const hm = sph(.72, skin, 0, .62, 0, head, 48); hm.scale.set(.92, 1.18, .92);
  // face decal on the front of the head
  const face = new THREE.Mesh(new THREE.SphereGeometry(.725, 64, 32, Math.PI * .5 - 1.15, 2.3, .55, 1.6),
    new THREE.MeshStandardMaterial({ map: grinTex, transparent: true, alphaTest: .4, roughness: .5 }));
  face.scale.copy(hm.scale); face.position.copy(hm.position); head.add(face); face.visible = !silhouette;
  // long black hair: covers the back of the head and falls down
  const hcap = new THREE.Mesh(new THREE.SphereGeometry(.77, 40, 20, 0, Math.PI * 2, 0, Math.PI * .5), hairM);
  hcap.scale.set(.95, 1.2, .95); hcap.position.set(0, .66, -.08); hcap.rotation.x = -.75; hcap.castShadow = true; head.add(hcap);
  const back = new THREE.Mesh(new THREE.CylinderGeometry(.72, 1.0, 2.1, 32, 1, true, Math.PI * .5, Math.PI), hairM);
  back.position.set(0, -.2, -.12); back.material.side = THREE.DoubleSide; back.castShadow = true; head.add(back);
  for (let i = 0; i < 9; i++) { const s = cap(.09, 1.7, hairM, -.6 + i * .15, -.25 - (i % 3) * .08, -.55 - Math.sin(i / 8 * Math.PI) * .3, head);
    s.rotation.x = .08; }
  g.userData = { head, arms, face };
  return g;
}

// ---------------------------------------------------------------- sets
function lightsCommon(scene, hemi = 0x34406a, ground = 0x120c0c, k = .55) {
  scene.add(new THREE.HemisphereLight(hemi, ground, k));
}
function spot(scene, color, intensity, pos, target, angle = .6, pen = .5, shadow = true) {
  const s = new THREE.SpotLight(color, intensity, 0, angle, pen, 2);
  s.position.copy(pos); s.target.position.copy(target); scene.add(s, s.target);
  if (shadow) { s.castShadow = true; s.shadow.mapSize.set(1024, 1024); s.shadow.bias = -.0004; s.shadow.radius = 4; }
  return s;
}
function point(scene, color, intensity, pos, dist = 0, shadow = false) {
  const p = new THREE.PointLight(color, intensity, dist, 2); p.position.copy(pos); scene.add(p);
  if (shadow) { p.castShadow = true; p.shadow.mapSize.set(512, 512); p.shadow.bias = -.002; }
  return p;
}

// --- bedroom (with the door to the hallway in the back wall)
function makeBedroom() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x05060c);
  const wall = clay(0x1d2747, { map: starWall('#1d2747', [3, 1.6]), bumpScale: .2 });
  const wallL = clay(0x1d2747, { map: starWall('#1d2747', [3, 1.6]), bumpScale: .2 });
  const panel = clay(0x6b4329, { map: planks('#6b4329', [1, 4]) });
  const floorM = clay(0x5a3a26, { map: planks('#5a3a26', [3, 3]) });
  box(14, .2, 14, floorM, 0, -.1, 0, s);
  // back wall with a door opening (x 1.45..2.95, height 3)
  box(6.45, 6, .2, wall, -1.775, 3, -4.1, s); box(4, 6, .2, wall, 4.95, 3, -4.1, s); box(1.5, 3, .2, wall, 2.2, 4.5, -4.1, s);
  box(6.45, 1.2, .05, panel, -1.775, .6, -3.98, s); box(4, 1.2, .05, panel, 4.95, .6, -3.98, s);
  box(.2, 6, 14, wallL, -5, 3, 0, s);
  // door frame + door panel (hinged at x=2.95, opened toward the hallway)
  const frame = clay(0xe8dcc0);
  box(.14, 3.1, .3, frame, 1.4, 1.55, -4.05, s); box(.14, 3.1, .3, frame, 3.0, 1.55, -4.05, s); box(1.74, .14, .3, frame, 2.2, 3.08, -4.05, s);
  const hinge = new THREE.Group(); hinge.position.set(2.92, 0, -4.12); s.add(hinge);
  rbox(1.45, 2.95, .1, .03, clay(0xd9ccb0), -.73, 1.48, 0, hinge); sph(.07, gloss(0xc9a24a), -1.3, 1.45, .08, hinge, 12);
  hinge.rotation.y = .5;
  // hallway behind the door: warm light
  box(6, .2, 6, floorM, 2.2, -.1, -7.2, s); box(6, 6, .2, clay(0x8a6b4a), 2.2, 3, -9.5, s);
  box(.2, 6, 6, clay(0x7a5c40), -.3, 3, -7.2, s); box(.2, 6, 6, clay(0x7a5c40), 5, 3, -7.2, s);
  const hallLamp = point(s, 0xffa040, 25, V(2.2, 3.5, -7.2), 0);
  const doorSpot = spot(s, 0xffb060, 180, V(2.4, 3.2, -8.6), V(1.6, 0, -1.4), .5, .35);
  // shadow-caster that walks past in the hallway
  const shadowThing = makeThing({ silhouette: true }); shadowThing.position.set(-1.5, 0, -6.4); s.add(shadowThing);
  shadowThing.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // bed against the back wall
  const wood = clay(0x7a4a2c);
  rbox(2.6, .6, 3.8, .08, wood, -1.2, .45, -2.0, s);                     // frame
  rbox(2.8, 2.2, .25, .1, wood, -1.2, 1.1, -3.9, s);                      // headboard
  rbox(2.4, .35, 3.6, .1, clay(0xf2efe6), -1.2, .9, -2.0, s);             // mattress
  const blanket = rbox(2.55, .28, 2.5, .12, clay(0xffffff, { map: checker('#2a9d8f', '#f4e9cf', 8) }), -1.2, 1.12, -1.4, s);
  const pillow = rbox(1.6, .35, .7, .17, clay(0xf7f3ea), -1.2, 1.2, -3.45, s); pillow.rotation.x = -.35;
  // nightstand + lamp
  rbox(.9, 1.0, .8, .05, wood, -3.2, .5, -3.4, s); cyl(.08, .12, .6, clay(0xd9ccb0), -3.2, 1.3, -3.4, s);
  const shade = cyl(.25, .4, .45, clay(0xf6d58a, { emissive: 0xffb040, emissiveIntensity: .6 }), -3.2, 1.75, -3.4, s);
  const lamp = point(s, 0xffa850, 7, V(-3.2, 1.75, -3.1), 0, true);
  // clock above the bed (drawn per frame)
  const clockTex = canvasTex(256, 256, () => {});
  const clockM = new THREE.Mesh(new THREE.CircleGeometry(.48, 48), new THREE.MeshStandardMaterial({ map: clockTex, roughness: .6 }));
  clockM.position.set(-1.2, 3.55, -3.97); s.add(clockM);
  mesh(new THREE.TorusGeometry(.5, .06, 12, 48), clay(0xd8263a), -1.2, 3.55, -3.97, s);
  // window on the left wall + moon light
  box(.05, 1.6, 1.4, glow(0x0d1a3a), -4.88, 2.6, -1.2, s);
  sph(.3, glow(0xe9f0ff), -4.85, 3.0, -1.45, s).scale.set(.2, 1, 1);
  box(.12, 1.8, .1, frame, -4.85, 2.6, -1.2, s); box(.12, .1, 1.6, frame, -4.85, 2.6, -1.2, s);
  const moon = new THREE.DirectionalLight(0x8fa6ff, .9); moon.position.set(-8, 6, -1); moon.target.position.set(0, 0, -1.5);
  moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -6; moon.shadow.camera.right = 6;
  moon.shadow.camera.top = 6; moon.shadow.camera.bottom = -6; s.add(moon, moon.target);
  lightsCommon(s, 0x34406a, 0x120c0c, .7);
  spot(s, 0xaebfff, 45, V(.6, 4.2, 3.2), V(-1.2, 1.9, -3), .32, .8, true);
  spot(s, 0xffa860, 25, V(-3.6, 2.6, -1.0), V(-1.2, 2.2, -3), .5, .8, false);
  // toys on the floor for life
  sph(.3, clay(0xd8263a), 1.0, .3, .8, s); rbox(.5, .5, .5, .06, clay(0x3a7bd5), .2, .25, 1.6, s).rotation.y = .5;
  const girl = makeGirl(); girl.scale.setScalar(.52); girl.position.set(-1.2, .78, -3.0); s.add(girl);
  girl.userData.legs.forEach(l => l.visible = false);
  return { scene: s, girl, clockTex, hinge, shadowThing, hallLamp, doorSpot, lamp, shade };
}

function drawClock(tex, minutes) {
  const g = tex.userData.ctx, w = 256; g.fillStyle = '#f4ead2'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#222'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2;
    g.beginPath(); g.arc(128 + Math.sin(a) * 100, 128 - Math.cos(a) * 100, i % 3 ? 5 : 9, 0, 7); g.fill(); }
  const hand = (a, len, wd) => { g.lineWidth = wd; g.lineCap = 'round'; g.strokeStyle = '#1a1a1a'; g.beginPath(); g.moveTo(128, 128);
    g.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); g.stroke(); };
  hand((minutes / 60 / 12) * Math.PI * 2, 58, 14); hand((minutes % 60) / 60 * Math.PI * 2, 88, 9);
  g.fillStyle = '#d8263a'; g.beginPath(); g.arc(128, 128, 10, 0, 7); g.fill();
  tex.needsUpdate = true;
}

// --- stairs (girl coming down, kitchen light from below)
function drawPhoto(g, w, h) {
  g.fillStyle = '#e9dcc0'; g.fillRect(0, 0, w, h); g.fillStyle = '#9fc3d9'; g.fillRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#7bb36a'; g.fillRect(14, h * .7, w - 28, h * .3 - 14);
  const person = (x, y, s, dress, hair) => { g.fillStyle = dress; g.beginPath(); g.moveTo(x - s * .5, y + s * 1.6); g.lineTo(x + s * .5, y + s * 1.6);
    g.lineTo(x + s * .25, y + s * .45); g.lineTo(x - s * .25, y + s * .45); g.fill(); g.fillStyle = hair;
    g.beginPath(); g.arc(x, y, s * .42, 0, 7); g.fill(); g.fillStyle = '#f2cfae'; g.beginPath(); g.arc(x, y + s * .05, s * .33, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(x - s * .12, y + s * .02, s * .05, 0, 7); g.arc(x + s * .12, y + s * .02, s * .05, 0, 7); g.fill();
    g.strokeStyle = '#7a2a2a'; g.lineWidth = 3; g.beginPath(); g.arc(x, y + s * .12, s * .12, .2, Math.PI - .2); g.stroke(); };
  person(w * .38, h * .38, 70, '#3c6fb4', '#5a3220'); person(w * .66, h * .52, 48, '#f2bf3f', '#4a2716');
}
function makeStairs() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x040407);
  const wallM = clay(0x5e4a3a, { map: starWall('#4a3d33', [2, 3]), bumpScale: .2 });
  const stepM = clay(0x6b4329, { map: planks('#6b4329', [1, 1]) }), carpet = clay(0x7a1f2b);
  box(16, .2, 16, clay(0x4a3020, { map: planks('#4a3020', [4, 4]) }), 0, -.1, 2, s);
  const N = 11;
  for (let i = 0; i < N; i++) {
    const top = 4.95 - i * .45, z = -4.2 + i * .62;
    box(2.8, top, .62, stepM, 0, top / 2, z, s); box(1.4, .03, .6, carpet, 0, top + .015, z, s);
  }
  box(.2, 9, 16, wallM, -1.5, 4.5, 0, s);                                  // left wall
  // banister
  const rail = clay(0x3b2316);
  const railMesh = box(.14, .14, 7.6, rail, 1.3, 0, 0, s); railMesh.position.set(1.3, 4.9, -1.1); railMesh.rotation.x = Math.atan2(.45, .62);
  for (let i = 0; i < N; i += 1) { const top = 4.95 - i * .45, z = -4.2 + i * .62; cyl(.04, .04, 1.1, clay(0xe8dcc0), 1.3, top + .55, z, s, 10); }
  // family photos on the wall
  const ph = new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, drawPhoto), roughness: .5 });
  for (const [y, z] of [[4.6, -2.2], [3.5, 0.4]]) { box(.08, 1.0, 1.0, clay(0x2a1a10), -1.38, y, z, s);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(.82, .82), ph); p.position.set(-1.33, y, z); p.rotation.y = Math.PI / 2; s.add(p); }
  // kitchen glow from below-right
  const glowL = point(s, 0xff9a40, 40, V(3.2, 1.6, 4.2), 0, true);
  const fill = spot(s, 0xffa860, 60, V(4, 2, 5.5), V(0, 3, -1), .55, .6, true);
  box(.1, 3.2, 2, glow(0x5a3410), 2.6, 1.6, 5.2, s);                       // lit doorway in distance
  lightsCommon(s, 0x2a3358, 0x140c08, .45);
  const girl = makeGirl(); girl.scale.setScalar(.55); s.add(girl);
  // phone in her right hand
  const phone = new THREE.Group(); girl.userData.arms[0].add(phone); phone.position.set(.05, -.95, .22);
  rbox(.32, .56, .05, .04, gloss(0x111318), 0, 0, 0, phone);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.28, .5), glow(0x9fb8ff)); scr.position.z = .03; scr.rotation.y = Math.PI; phone.add(scr);
  phone.rotation.x = -1.0;
  const phoneLight = point(s, 0x9fb8ff, 0, V(0, 0, 0), 2.5);
  return { scene: s, girl, phone, scr, phoneLight, glowL };
}
const stepPos = i => V(0, 4.95 - i * .45, -4.2 + i * .62);

// --- phone close-up
function drawPhone(tex, t, notifyT) {
  const g = tex.userData.ctx, w = 600, h = 1200;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1b1f4a'); bg.addColorStop(1, '#3a1840');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.arc(w * .75, h * .8, 260, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = '600 34px Mont, sans-serif'; g.fillText('Friday, October 31', w / 2, 180);
  g.font = '800 170px Mont, sans-serif'; g.fillText('7:00', w / 2, 350);
  g.font = '600 26px Mont, sans-serif'; g.fillText('100%', w - 70, 50); g.textAlign = 'left'; g.fillText('7:00', 40, 50);
  const k = easeOut((t - notifyT) / .35);
  if (t > notifyT) {
    const y = lerp(-220, 430, k);
    g.globalAlpha = clamp((t - notifyT) / .2);
    g.fillStyle = 'rgba(245,245,250,.95)'; roundRect(g, 26, y, w - 52, 250, 34); g.fill();
    g.fillStyle = '#34c759'; roundRect(g, 52, y + 30, 64, 64, 16); g.fill();
    g.fillStyle = '#fff'; g.font = '800 40px Mont'; g.textAlign = 'center'; g.fillText('\u{1F4AC}', 84, y + 76);
    g.textAlign = 'left'; g.fillStyle = '#111'; g.font = '800 36px Mont, "Noto Color Emoji"'; g.fillText('Mom ❤️', 136, y + 74);
    g.fillStyle = '#777'; g.font = '600 28px Mont'; g.textAlign = 'right'; g.fillText('now', w - 60, y + 72); g.textAlign = 'left';
    g.fillStyle = '#111'; g.font = '700 34px Mont, "Noto Color Emoji"';
    g.fillText('Stuck at work till midnight.', 56, y + 150);
    g.fillText('Lock your door. \u{1F629}', 56, y + 200);
    g.globalAlpha = 1;
  }
  tex.needsUpdate = true;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

function makePhoneShot() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x07050a);
  const grp = new THREE.Group(); s.add(grp);
  rbox(2.3, 4.6, .22, .25, gloss(0x15161c), 0, 0, 0, grp);
  const tex = canvasTex(600, 1200, () => {});
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 4.2), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  screen.position.z = .115; grp.add(screen);
  const skin = clay(0xf2cfae);
  for (const sx of [-1, 1]) { // hands
    const hnd = sph(.75, skin, sx * 1.25, -1.6, -.3, grp); hnd.scale.set(.75, 1.3, .7);
    for (let f = 0; f < 3; f++) { const fi = cap(.16, .5, skin, sx * 1.12, -.3 + f * .45 - 1.2, .05, grp); fi.rotation.z = sx * 1.3; }
  }
  const thumb = cap(.17, .6, skin, .7, -1.95, .3, grp); thumb.rotation.z = .9;
  // bokeh of the warm hallway behind
  const bok = radial('rgba(255,170,80,.9)');
  for (let i = 0, r = rng(5); i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: bok, transparent: true,
    opacity: .25 + r() * .3, depthWrite: false })); sp.position.set(-5 + r() * 10, -6 + r() * 14, -8 - r() * 4);
    sp.scale.setScalar(1.5 + r() * 2.5); s.add(sp); }
  point(s, 0x9fb8ff, 25, V(0, 0, 2.5)); point(s, 0xff9a40, 30, V(3, -3, -1));
  lightsCommon(s, 0x2a3358, 0x140c08, .5);
  return { scene: s, grp, tex, screen };
}

// --- kitchen
function makeKitchen() {
  const s = new THREE.Scene(); s.background = new THREE.Color(0x030303); s.fog = new THREE.Fog(0x050302, 9, 20);
  box(16, .2, 16, clay(0xffffff, { map: checker('#1a1a1a', '#d9cfb5', 2), bumpScale: .1 }), 0, -.1, 0, s)
    .material.map.repeat.set(8, 8);
  const floor = s.children[0]; floor.material.map.wrapS = floor.material.map.wrapT = THREE.RepeatWrapping;
  const tileM = clay(0xffffff, { map: tiles('#8fb3a0', '#5e7a6c', [6, 3]), bumpScale: .2 });
  box(12, 6, .2, tileM, 0, 3, -4.1, s); box(.2, 6, 12, clay(0x4f6b5d), -4.5, 3, 0, s); box(.2, 6, 12, clay(0x4f6b5d), 4.5, 3, 0, s);
  box(12, .2, 12, clay(0x2a2a2a), 0, 6, 0, s);
  const wood = clay(0x8a5a34), top = clay(0xd8d2c4, { roughness: .4 });
  rbox(8, 1.6, 1.1, .04, wood, 0, .8, -3.45, s); box(8.1, .1, 1.2, top, 0, 1.65, -3.42, s);
  rbox(8, 1.2, .7, .04, wood, 0, 4.4, -3.7, s);                                  // upper cabinets
  for (let x = -3.5; x <= 3.5; x += 1) { box(.9, 1.3, .03, clay(0x9a6a42), x, .82, -2.88, s); sph(.05, gloss(0xc9a24a), x + .3, 1.1, -2.85, s, 8); }
  // stove + pot + steam
  box(1.6, .06, 1, clay(0x222222), 0, 1.72, -3.4, s);
  const pot = cyl(.42, .38, .55, clay(0x8c8c90, { roughness: .35, metalness: .4 }), -.25, 2.03, -3.35, s);
  const steamTex = radial('rgba(230,230,230,.55)');
  const steam = [];
  for (let i = 0; i < 14; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamTex, transparent: true, depthWrite: false }));
    s.add(sp); steam.push(sp); }
  // fridge + window
  rbox(1.4, 3.6, 1.1, .1, clay(0xd9dfe0, { roughness: .4 }), -3.6, 1.8, -3.3, s);
  box(1.8, 1.2, .05, glow(0x060a18), 2.6, 3.0, -3.98, s);
  // hanging lamp
  cyl(.02, .02, .8, clay(0x111111), 0, 5.6, -.9, s, 6);
  const shade = cyl(.15, .65, .5, clay(0x2b2b2b), 0, 5.0, -.9, s);
  sph(.14, glow(0xffd9a0), 0, 4.78, -.9, s, 12);
  const lamp = spot(s, 0xffc078, 120, V(0, 4.75, -.9), V(0, 0, -2.0), 1.05, .6, true);
  const faceLight = point(s, 0xffb48a, 0, V(.15, 4.1, -.6), 4);
  const amb = point(s, 0xff9a50, 6, V(0, 3, 1), 0);
  lightsCommon(s, 0x223040, 0x100808, .35);
  // doorway edges in the foreground (peeking in)
  const frameM = clay(0x1a120c); box(.5, 6, .3, frameM, -2.2, 3, 3.6, s); box(.5, 6, .3, frameM, 3.4, 3, 3.6, s);
  const thing = makeThing(); thing.scale.setScalar(.85); thing.position.set(.15, 0, -2.25); thing.rotation.y = Math.PI; s.add(thing);
  thing.userData.arms[0].rotation.x = -.9; thing.userData.arms[0].rotation.z = .25;
  thing.userData.arms[1].rotation.x = -.5;
  const spoon = cyl(.03, .03, 1, clay(0x6b4329), 0, -2.9, .3, thing.userData.arms[0], 6); spoon.rotation.x = 1.2;
  return { scene: s, thing, lamp, steam, pot, amb, shade, faceLight };
}

// ---------------------------------------------------------------- build
const camera = new THREE.PerspectiveCamera(50, W / H, .05, 100);
let BED, ST, PH, KI, TL;

function shotAt(t) { let cur = TL.shots[0], next = null;
  for (let i = 0; i < TL.shots.length; i++) if (TL.shots[i].t <= t) { cur = TL.shots[i]; next = TL.shots[i + 1]; }
  return { name: cur.name, t0: cur.t, t1: next ? next.t : TL.total }; }

function look(pos, target, fov = 50) { camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(target); }
function punch(local, fov) { return fov * (1 - .1 * Math.exp(-local * 9)); } // quick zoom-settle on every cut

// annotation state set by shots (world point to circle)
let ann = null;

const SHOTS = {
  bedroom(lt, t, d) {
    const { girl } = BED;
    drawClock(BED.clockTex, t < TL.marks.seven ? 6 * 60 + 59 : 7 * 60);
    girl.userData.head.rotation.set(.05 + Math.sin(t * 1.3) * .02, Math.sin(t * .8) * .06, 0);
    girl.userData.arms.forEach((a, i) => { a.rotation.x = -.5; });
    setExpr(girl, 'calm', t);
    BED.hinge.rotation.y = .12; BED.shadowThing.visible = false;
    const k = easeInOut(lt / d);
    look(V(lerp(-.6, -1.0, k), lerp(2.6, 2.4, k), lerp(6.4, 4.6, k)), V(-1.1, 2.0, -3), punch(lt, 50));
  },
  door(lt, t, d) {
    const { girl } = BED; drawClock(BED.clockTex, 7 * 60);
    BED.hinge.rotation.y = .12 + easeOut(lt / .6) * .5; BED.shadowThing.visible = false;
    const turn = smooth(.05, .75, lt);
    girl.userData.head.rotation.set(.02, turn * 1.05, turn * -.08);
    setExpr(girl, 'curious', t);
    const k = easeInOut(lt / d);
    look(V(lerp(-1.3, -.9, k), 2.3, lerp(3.6, 2.4, k)), V(lerp(.05, .4, k), 1.7, -3.6), punch(lt, 50));
  },
  doorgap(lt, t, d) {
    BED.hinge.rotation.y = .62; BED.shadowThing.visible = true;
    BED.shadowThing.position.x = lerp(-1.4, 5.5, smooth(.4, d + .2, lt));
    BED.shadowThing.position.z = -6.6;
    BED.hallLamp.intensity = 25 * (1 - .25 * (Math.sin(t * 31) > .7 ? 1 : 0));
    const k = easeInOut(lt / d);
    look(V(lerp(.6, 1.2, k), lerp(1.5, 1.4, k), lerp(1.2, -.4, k)), V(2.2, 1.35, -4.6), punch(lt, 48));
  },
  stairs(lt, t, d) {
    const { girl } = ST;
    const buzz = TL.marks.buzz - (t - lt); // local time of buzz
    // walk down from step 2 to step 5, stop at the buzz
    const walk = clamp(lt / Math.max(.1, buzz - .1));
    const stepF = lerp(3, 5, walk), si = Math.floor(stepF), fr = stepF - si;
    const p = stepPos(si).lerp(stepPos(si + 1), smooth(.3, 1, fr)); p.y += Math.sin(fr * Math.PI) * .12 * (walk < 1 ? 1 : 0);
    girl.position.copy(p); girl.rotation.y = 0;
    girl.userData.legs[0].position.y = .38 + (walk < 1 ? Math.max(0, Math.sin(stepF * Math.PI * 2)) * .15 : 0);
    girl.userData.legs[1].position.y = .38 + (walk < 1 ? Math.max(0, -Math.sin(stepF * Math.PI * 2)) * .15 : 0);
    const ar = girl.userData.arms; ar[0].rotation.set(-1.1, 0, -.25); ar[1].rotation.set(walk < 1 ? Math.sin(stepF * 6.28) * .3 : .1, 0, .2);
    const after = lt - buzz;
    const buzzOn = after > 0 && after < .9 && Math.sin(after * 60) > 0;
    ST.scr.material.color.set(after > 0 ? 0xdfe8ff : 0x223355);
    ST.phoneLight.intensity = after > 0 ? 1.6 : .2;
    ST.phone.getWorldPosition(ST.phoneLight.position); ST.phoneLight.position.z += .25;
    if (buzzOn) ST.phone.position.x = .05 + Math.sin(after * 120) * .03; else ST.phone.position.x = .05;
    girl.userData.head.rotation.set(after > 0 ? smooth(0, .4, after) * .45 : .05, 0, 0);
    setExpr(girl, after > 0 ? 'worried' : 'calm', t);
    const k = easeInOut(lt / d);
    const sh = after > 0 ? shake(t, .05 * Math.exp(-after * 3)) : V(0, 0, 0);
    const tgt = girl.position.clone().add(V(0, 1.2, 0));
    look(V(lerp(.8, .5, k), lerp(2.0, 2.4, k), lerp(6.4, 5.2, k)).add(sh), tgt, punch(lt, 46));
  },
  phone(lt, t, d) {
    drawPhone(PH.tex, t, TL.marks.notify);
    const n = t - TL.marks.notify;
    const bz = n > 0 && n < .6 ? Math.sin(n * 90) * .04 * (1 - n / .6) : 0;
    PH.grp.rotation.set(-.12 + bz * .3, .1 + Math.sin(t * .7) * .02, -.04 + bz);
    PH.grp.position.set(0, -.2, 0);
    const k = easeInOut(lt / d);
    look(V(0, lerp(-.2, .55, k), lerp(9.0, 6.6, k)), V(0, lerp(-.2, .55, k), 0), punch(lt, 38));
    // circle the message
    if (t >= TL.marks.circle) { PH.screen.updateMatrixWorld(); ann = { p: PH.screen.localToWorld(V(0, .16, 0.01)), r: 330, t0: TL.marks.circle, arrow: 'bl' }; }
  },
  kitchen(lt, t, d) { kitchenCommon(t); const th = KI.thing;
    th.userData.head.rotation.set(0, 0, Math.sin(t * .9) * .05 + .12);
    const k = easeInOut(lt / d);
    look(V(lerp(1.3, .9, k), lerp(2.6, 2.8, k), lerp(8.6, 7.0, k)), V(.1, 2.45, -2.4), punch(lt, 50));
  },
  turn(lt, t, d) { kitchenCommon(t, false, .3); const th = KI.thing;
    th.userData.arms[0].rotation.x = -.9; // stops stirring
    // head turns all the way around in creepy stutters
    const raw = clamp((lt - .4) / (d - .9));
    const steps = 4, stepK = Math.floor(raw * steps) / steps, frac = raw * steps % 1;
    const turn = raw >= 1 ? 1 : stepK + smooth(.0, .35, frac) / steps;
    th.userData.head.rotation.set(0, turn * Math.PI, (1 - turn) * .12 + turn * -.18);
    const k = easeInOut(lt / d);
    const sh = shake(t, .01 + turn * .015);
    KI.faceLight.intensity = .3 + turn * 1.6;
    look(V(lerp(.6, .3, k), 3.85, lerp(2.0, .7, k)).add(sh), V(.15, 3.95, -2.25), punch(lt, 46));
  },
  scare(lt, t, d) { kitchenCommon(t, true, .3); const th = KI.thing;
    th.userData.head.rotation.set(0, Math.PI, -.18 + Math.sin(lt * 40) * .05);
    const lunge = easeOut(lt / .25);
    th.userData.head.scale.setScalar(1 + lunge * .15);
    const sh = shake(t, .12 * Math.exp(-lt * 1.5));
    KI.faceLight.intensity = 2.4 * (Math.sin(lt * 50) > -.3 ? 1 : .3);
    const fp = V(.15, 4.1, -2.25 + .5);  // face front
    look(V(.15, 4.1, lerp(1.7, .3, lunge)).add(sh), fp, 50 + Math.sin(lt * 25) * 2);
  },
  endcard(lt, t, d) {
    const { girl } = ST;
    girl.position.copy(stepPos(5)); girl.rotation.y = 0;
    girl.userData.legs.forEach(l => l.position.y = .38);
    girl.userData.arms[0].rotation.set(-.7, 0, -.4); girl.userData.arms[1].rotation.set(-.7, 0, .4);
    girl.userData.head.rotation.set(-.08, 0, Math.sin(t * 30) * .006);
    setExpr(girl, 'terror', t);
    ST.phoneLight.intensity = 1.2; ST.phone.getWorldPosition(ST.phoneLight.position); ST.phoneLight.position.z += .4;
    girl.userData.refl.material.opacity = 1;
    const k = easeOut(lt / d);
    const head = girl.userData.head.localToWorld(V(0, 1.0, 0));
    look(V(head.x + .15, head.y - .05, head.z + lerp(3.1, 2.6, k)), V(head.x, head.y - .1, head.z), punch(lt, 40));
    girl.updateMatrixWorld(true);
    ann = { p: girl.userData.eyes[1].localToWorld(V(0, 0, .1)), r: 120, t0: TL.marks.endcard + .35, arrow: 'bl2' };
  },
};

function kitchenCommon(t, scare = false, dim = 1) {
  const th = KI.thing;
  th.userData.arms[0].rotation.x = -.9 + Math.sin(t * 3) * .12;
  th.userData.arms[0].rotation.y = Math.sin(t * 3) * .25;
  th.userData.head.scale.setScalar(1);
  // flickering lamp
  const f = Math.sin(t * 13.7) + Math.sin(t * 29.3) * .6 + Math.sin(t * 7.1);
  KI.faceLight.intensity = 0;
  KI.lamp.intensity = dim * (f > 1.6 ? 30 : 120) * (scare ? (Math.sin(t * 50) > 0 ? 1.4 : .15) : 1);
  KI.steam.forEach((sp, i) => { const ph = (t * .35 + i / KI.steam.length) % 1;
    sp.position.set(-.25 + Math.sin(i * 3.1 + t) * .15 * ph, 2.35 + ph * 1.8, -3.35 + Math.cos(i * 1.7) * .1);
    sp.scale.setScalar(.3 + ph * .9); sp.material.opacity = (1 - ph) * .45 * smooth(0, .15, ph); });
}

function setExpr(girl, e, t) {
  const u = girl.userData;
  const blink = (t % 3.7) < .1 ? .1 : 1;
  const E = { calm: [1, .4, 1, 0], curious: [1.05, .5, 1.05, .05], worried: [1.1, .9, 1.1, .1], terror: [1.25, 1.6, 1.25, .16] }[e];
  u.eyes.forEach(x => x.scale.set(E[0], E[0] * (e === 'terror' ? 1 : blink), 1));
  u.mouth.scale.set(e === 'calm' ? 1.1 : .9, E[1] * .5, .4);
  u.brows.forEach((b, i) => { b.position.y = 1.42 + E[3]; b.rotation.z = Math.PI / 2 + (i ? -1 : 1) * (e === 'calm' ? .2 : -.25); });
  u.refl.material.opacity = 0;
}

// ---------------------------------------------------------------- overlay
const $ = id => document.getElementById(id);
const grainC = $('grain'), grainG = grainC.getContext('2d'), grainImg = grainG.createImageData(270, 480);
function drawGrain(f) { const r = rng(f * 7919 + 1), d = grainImg.data;
  for (let i = 0; i < d.length; i += 4) { const v = r() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  grainG.putImageData(grainImg, 0, 0); }

let lastWordKey = '';
function updateSubs(t) {
  const sub = $('sub');
  let cur = null;
  for (const l of TL.lines) for (let i = 0; i < l.words.length; i++) {
    const w = l.words[i], nx = l.words[i + 1];
    const end = nx ? nx.s : w.e + .35;
    if (t >= w.s - .03 && t < end) cur = { w, line: l };
  }
  if (t >= TL.marks.scare) cur = null;
  if (!cur) { sub.innerHTML = ''; return; }
  const creepy = cur.line.id.startsWith('m');
  const text = cur.w.w.toUpperCase().replace(/[.,!?]/g, '') + (cur.w === cur.line.words.at(-1) ? (creepy ? '"' : '.') : '');
  const pre = creepy && cur.w === cur.line.words[0] ? '"' : '';
  const age = t - cur.w.s;
  const sc = 1 + .32 * Math.exp(-age * 18) * (age > 0 ? 1 : 0);
  const cls = cur.w.red || creepy ? 'rd' : 'yel';
  const jit = creepy ? `translate(${Math.sin(t * 61) * 4}px, ${Math.cos(t * 53) * 4}px)` : '';
  sub.innerHTML = `<span class="${cls}" style="transform: ${jit} scale(${sc.toFixed(3)})">${pre}${text}</span>`;
}

function updateAnno(t) {
  const ring = $('ring'), arrow = $('arrow');
  if (!ann || t < ann.t0) { ring.style.opacity = 0; arrow.style.opacity = 0; return; }
  const p = ann.p.clone().project(camera); const x = (p.x * .5 + .5) * W, y = (-p.y * .5 + .5) * H;
  const k = easeOut((t - ann.t0) / .35);
  const C = 2 * Math.PI * ann.r;
  ring.setAttribute('cx', x); ring.setAttribute('cy', y); ring.setAttribute('r', ann.r);
  ring.style.opacity = 1; ring.setAttribute('stroke-dasharray', C); ring.setAttribute('stroke-dashoffset', C * (1 - k));
  const ka = easeOut((t - ann.t0 - .25) / .3);
  const dir = ann.arrow === 'bl' ? [-1, 1] : [-1, 1];
  const ex = x + dir[0] * ann.r * .78, ey = y + dir[1] * ann.r * .78;
  const len = ann.r * 1.2 * ka, sx = ex + dir[0] * len, sy = ey + dir[1] * len * .9;
  arrow.style.opacity = ka > 0 ? 1 : 0;
  $('arrowLine').setAttribute('x1', sx); $('arrowLine').setAttribute('y1', sy);
  $('arrowLine').setAttribute('x2', ex - dir[0] * 18); $('arrowLine').setAttribute('y2', ey - dir[1] * 18);
  const ang = Math.atan2(ey - sy, ex - sx), hs = 46;
  const pts = [[ex, ey], [ex - Math.cos(ang - .45) * hs, ey - Math.sin(ang - .45) * hs], [ex - Math.cos(ang + .45) * hs, ey - Math.sin(ang + .45) * hs]];
  $('arrowHead').setAttribute('points', pts.map(q => q.join(',')).join(' '));
  if (ka <= 0) arrow.style.opacity = 0;
}

function updateOverlay(t, shot) {
  const scare = TL.marks.scare, end = TL.marks.endcard;
  const inEnd = t >= end;
  $('title').style.opacity = t < scare ? 1 : 0;
  $('topshade').style.opacity = t < scare || inEnd ? 1 : 0;
  // title pops in at the start
  $('title').style.transform = `scale(${(1 + .25 * Math.exp(-t * 10)).toFixed(3)})`;
  updateSubs(t);
  // red flash + black on the scare
  const ls = t - scare;
  $('flash').style.opacity = ls >= 0 && ls < 1.35 ? (Math.sin(ls * 38) > .2 ? .38 : .06) * Math.exp(-ls * 1.4) : 0;
  $('black').style.opacity = (t > scare - .5 && t < scare) ? .35 : 0;
  // end card
  const le = t - end;
  $('endshade').style.opacity = inEnd ? 1 : 0;
  const pop = (el, t0) => { const a = t - t0; el.style.opacity = a > 0 ? 1 : 0; el.style.transform = `scale(${(1 + .3 * Math.exp(-Math.max(0, a) * 12)).toFixed(3)})`; };
  pop($('endtop'), end + .05); pop($('endbot'), end + .45);
  if (!inEnd) { $('endtop').style.opacity = 0; $('endbot').style.opacity = 0; }
  // end-bottom lines appear one by one
  const lines = $('endbot').children;
  for (let i = 0; i < lines.length; i++) lines[i].style.opacity = le > .45 + i * .5 ? 1 : 0;
  updateAnno(t);
}

// ---------------------------------------------------------------- api
window.setup = async (timeline) => {
  TL = timeline;
  BED = makeBedroom(); ST = makeStairs(); PH = makePhoneShot(); KI = makeKitchen();
  await document.fonts.load('900 80px Mont'); await document.fonts.load('800 80px Mont'); await document.fonts.ready;
  return true;
};

window.renderFrame = (t, frameIndex = Math.round(t * 30)) => {
  ann = null;
  const sh = shotAt(t), lt = t - sh.t0, d = sh.t1 - sh.t0;
  SHOTS[sh.name](lt, t, d);
  const scene = { bedroom: BED, door: BED, doorgap: BED, stairs: ST, phone: PH, kitchen: KI, turn: KI, scare: KI, endcard: ST }[sh.name].scene;
  renderer.render(scene, camera);
  updateOverlay(t, sh.name);
  drawGrain(frameIndex);
  return sh.name;
};
window.__ready = true;
