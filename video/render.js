// Frame-by-frame capture of scene.html with headless Chromium.
//   node render.js --ep ep2                 -> build/ep2/frames/f00000.jpg ... (all frames)
//   node render.js --ep ep2 --stills 1,5,9  -> build/ep2/stills/t1.00.png ... (preview frames)
//   node render.js --ep ep2 --from 10 --to 12
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = __dirname;
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const EP = opt('ep', 'ep2'), B = path.join(ROOT, 'build', EP);
const TL = JSON.parse(fs.readFileSync(path.join(B, 'timeline.json'), 'utf8'));
const FPS = TL.fps;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 1; });
  await page.goto(`http://127.0.0.1:${port}/scene.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.evaluate(tl => window.setup(tl), TL);
  const stage = await page.$('#stage');

  const stills = opt('stills');
  if (stills) {
    const dir = path.join(B, 'stills'); fs.mkdirSync(dir, { recursive: true });
    for (const s of stills.split(',').map(Number)) {
      const shot = await page.evaluate(t => window.renderFrame(t), s);
      const f = path.join(dir, `t${s.toFixed(2)}.png`);
      await stage.screenshot({ path: f, type: 'png' });
      console.log(f, shot);
    }
  } else {
    const dir = path.join(B, 'frames'); fs.mkdirSync(dir, { recursive: true });
    const n = Math.round(TL.total * FPS);
    const from = Math.round(Number(opt('from', 0)) * FPS), to = Math.min(n, Math.round(Number(opt('to', TL.total)) * FPS));
    const t0 = Date.now();
    for (let f = from; f < to; f++) {
      await page.evaluate(([t, f]) => window.renderFrame(t, f), [f / FPS, f]);
      await stage.screenshot({ path: path.join(dir, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
      if (f % 30 === 0) console.log(`frame ${f}/${n}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }
  await browser.close(); server.close();
})();
