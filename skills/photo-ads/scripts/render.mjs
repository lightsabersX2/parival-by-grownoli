#!/usr/bin/env node
// Renders an HTML file or a website to a PNG in a throwaway headless browser, then reports what went wrong.
// usage: node render.mjs <file.html|https://...> <out.png> [--size 1080x1080] [--full] [--older] [--seal]
// Needs Node 22 or later and Chrome, Chromium, Edge or Brave. CHROME_BIN overrides the search.
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';

const args = process.argv.slice(2), full = args.includes('--full'), older = args.includes('--older'), seal = args.includes('--seal');
const sizeAt = args.indexOf('--size'), [W, H] = (sizeAt >= 0 ? args[sizeAt + 1] : '1080x1080').split('x').map(Number);
const [input, out] = args.filter((a, i) => !a.startsWith('--') && (sizeAt < 0 || i !== sizeAt + 1));
if (!input || !out) { console.error('usage: node render.mjs <file.html|url> <out.png> [--size WxH] [--full] [--older] [--seal]'); process.exit(2); }

const candidates = [process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
const chrome = candidates.find(c => c && fs.existsSync(c));
if (!chrome) { console.error('No browser found. Install Chrome or set CHROME_BIN.'); process.exit(2); }

const url = /^https?:/.test(input) ? input : 'file://' + path.resolve(input);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-ads-'));
const browser = spawn(chrome, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--disable-extensions', '--disable-sync', '--use-mock-keychain', '--password-store=basic', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
const finish = code => { browser.kill('SIGKILL'); setTimeout(() => { fs.rmSync(profile, { recursive: true, force: true }); process.exit(code); }, 200); };
setTimeout(() => { console.error('Render timed out after 60 s.'); finish(3); }, 60000);

const wsUrl = await new Promise(res => { let b = ''; browser.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\S+)/); if (m) res(m[1]); }); });
const sock = new WebSocket(wsUrl); await new Promise(r => (sock.onopen = r));
let id = 0, loaded = false; const pending = new Map();
sock.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Page.loadEventFired') loaded = true; };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { pending.set(++id, { res, rej }); sock.send(JSON.stringify({ id, method, params, sessionId })); });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, s); await send('Runtime.enable', {}, s);
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false }, s);
await send('Page.navigate', { url }, s);
// Some websites never finish loading, so the wait has a limit.
for (const start = Date.now(); !loaded && Date.now() - start < 15000;) await new Promise(r => setTimeout(r, 30));
// Websites: refuse every cookie that can be refused, then scroll the page so late pictures load.
if (/^https?:/.test(input)) {
  const decline = `(() => { const words = /^(neka( alla)?|avvisa( alla)?|avböj( alla)?|endast nödvändiga( cookies)?|bara nödvändiga( cookies)?|tillåt endast nödvändiga|använd endast nödvändiga cookies|reject all|decline( all)?|deny( all)?|only necessary( cookies)?|necessary (cookies )?only|use necessary cookies only|refuse all|allow only essential( cookies)?|decline optional cookies|only allow essential cookies|neka valfria cookies|avvisa valfria cookies)$/i;
    const docs = [document, ...[...document.querySelectorAll('iframe')].map(f => { try { return f.contentDocument; } catch { return null; } }).filter(Boolean)];
    for (const d of docs) for (const b of d.querySelectorAll('button, [role=button], a, input[type=button], input[type=submit]')) { const t = (b.innerText || b.value || '').trim().replace(/\\s+/g, ' ');
      if (words.test(t) && b.getBoundingClientRect().width) { b.click(); return t; } } return ''; })()`;
  for (let i = 0; i < 3; i++) { const r = await send('Runtime.evaluate', { expression: decline, returnByValue: true }, s); if (r.result.value) { console.error('cookies: clicked "' + r.result.value + '"'); break; } await new Promise(r => setTimeout(r, 1500)); }
  await send('Runtime.evaluate', { expression: `(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise(r => setTimeout(r, 250)); } scrollTo(0, 0); await new Promise(r => setTimeout(r, 1500)); })()`, awaitPromise: true }, s);
}

const inspect = `(async () => {
  await Promise.race([Promise.all([document.fonts.ready, Promise.allSettled([...document.images].map(i => i.decode()))]), new Promise(r => setTimeout(r, 8000))]); await new Promise(r => setTimeout(r, 400));
  const ctx = document.createElement('canvas').getContext('2d'), width = font => (ctx.font = '40px ' + font, ctx.measureText('Hamburgefonstiv åäö').width);
  const installed = f => ['monospace', 'serif'].some(b => width('"' + f + '",' + b) !== width(b));
  const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-[a-z-]+|-apple-system)$/i, problems = [];
  for (const i of document.images) if (!i.naturalWidth) problems.push('image did not load: ' + i.getAttribute('src'));
  // --seal: the brand's ads must carry a mark (a charity seal, a licence mark), tagged data-role="seal"
  if (${seal} && document.querySelector('[data-role]') && !document.querySelector('[data-role=seal]')) problems.push('no seal: the mark the brand requires on every ad is missing');
  const texts = [...document.querySelectorAll('body *')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
  for (const e of [...new Set([...texts, ...document.querySelectorAll('[data-role]')])]) {
    const r = e.getBoundingClientRect(), name = e.dataset.role || e.textContent.trim().slice(0, 40);
    if (r.width && (r.left < -1 || r.top < -1 || r.right > ${W} + 1 || r.bottom > ${H} + 1)) problems.push('outside the ad: ' + name);
    if (texts.includes(e) && ['hidden', 'clip'].includes(getComputedStyle(e).overflow) && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 4)) problems.push('text cut off: ' + name);
  }
  for (const f of new Set(texts.map(e => getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()))) if (!generic.test(f) && !installed(f)) problems.push('font not available: ' + f);
  // No wall of text: a headline over twelve words is cut before it is set, whoever wrote it, a quote included.
  for (const e of document.querySelectorAll('[data-role=headline]')) { const n = e.innerText.split(/\\s+/).filter(w => /[\\p{L}\\p{N}]/u.test(w)).length; if (n > 12) problems.push('headline is ' + n + ' words, over 12: ' + e.innerText.trim().replace(/\\s+/g, ' ').slice(0, 40)); }
  // An ad is read on a phone, where 1080 px shrinks to about 390 points. The headline and the supporting line need a 24th of the width (45 px, 16 points); nothing else goes under a 30th (36 px, 13 points). With --older the floors are a 20th (54 px, 19.5 points) and a 27th (40 px).
  if (document.querySelector('[data-role]')) for (const e of texts) { const c = getComputedStyle(e), fs = parseFloat(c.fontSize), r = e.getBoundingClientRect(), min = ${W} / (e.closest('[data-role=headline],[data-role=text]') ? ${older ? 20 : 24} : ${older ? 27 : 30});
    if (!e.closest('[aria-hidden=true]') && r.width > 1 && r.height > 1 && c.visibility !== 'hidden' && +c.opacity > 0 && r.right > 0 && r.bottom > 0 && fs < min - 0.5) problems.push('text under ' + Math.round(min) + ' px, too small on a phone: ' + e.textContent.trim().replace(/\\s+/g, ' ').slice(0, 40) + ' (' + Math.round(fs) + ' px)'); }
  // Words are measured by their letters, not their line boxes, so tight line spacing is not read as a tight layout. Buttons keep their full shape.
  const lettersOf = e => { const boxes = [...e.querySelectorAll('img,svg')].map(i => i.getBoundingClientRect()), walk = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const n = walk.currentNode; if (!n.textContent.trim()) continue; const c = getComputedStyle(n.parentElement), g = document.createRange(); ctx.font = c.fontStyle + ' ' + c.fontWeight + ' ' + c.fontSize + ' ' + c.fontFamily; g.selectNodeContents(n);
      const m = ctx.measureText(n.textContent.trim()), inset = (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) || 0, under = (m.fontBoundingBoxDescent - m.actualBoundingBoxDescent) || 0;
      for (const r of g.getClientRects()) if (r.width) boxes.push({ left: r.left, right: r.right, top: r.top + inset, bottom: r.bottom - under }); }
    return boxes.length ? { left: Math.min(...boxes.map(b => b.left)), top: Math.min(...boxes.map(b => b.top)), right: Math.max(...boxes.map(b => b.right)), bottom: Math.max(...boxes.map(b => b.bottom)) } : e.getBoundingClientRect(); };
  const margin = 80, gap = 32, parts = [...document.querySelectorAll('[data-role]')].filter(e => e.dataset.role !== 'hero').map(e => [e.dataset.role, e.dataset.role === 'cta' ? e.getBoundingClientRect() : lettersOf(e)]);
  for (const [name, r] of parts) if (r.left < margin || r.top < margin || r.right > ${W} - margin || r.bottom > ${H} - margin) problems.push('inside the 80 px margin: ' + name);
  for (const [i, [a, p]] of parts.entries()) for (const [b, q] of parts.slice(i + 1)) if (Math.max(q.left - p.right, p.left - q.right, q.top - p.bottom, p.top - q.bottom) < gap) problems.push('under 32 px apart: ' + a + ' and ' + b);
  const images = [...document.querySelectorAll('body *')].map(e => { const r = e.getBoundingClientRect(), bg = getComputedStyle(e).backgroundImage.match(/url\\(["']?([^"')]+)/); return { src: e.currentSrc || e.poster || (bg && bg[1]) || '', shown: Math.round(r.width) + 'x' + Math.round(r.height), area: r.width * r.height }; }).filter(i => i.src).sort((a, b) => b.area - a.area).slice(0, 12).map(({ src, shown }) => ({ src, shown }));
  const roles = Object.fromEntries([...document.querySelectorAll('[data-role]')].map(e => [e.dataset.role, e.tagName === 'IMG' ? e.getAttribute('src') : e.textContent.trim().replace(/\\s+/g, ' ')]));
  // where each role sits, as shares of the ad, so a set of formats can be compared for one layout resized
  const boxes = Object.fromEntries([...document.querySelectorAll('[data-role]')].map(e => { const r = e.getBoundingClientRect(); return [e.dataset.role, [r.left / ${W}, r.top / ${H}, r.width / ${W}, r.height / ${H}].map(v => Math.round(v * 1000) / 1000)]; }));
  return { problems: [...new Set(problems)], roles, boxes, images };
})()`;
const evaluated = await send('Runtime.evaluate', { expression: inspect, awaitPromise: true, returnByValue: true }, s);
const info = evaluated.result.value ?? { problems: ['page check failed'], roles: {} };
if (full) info.problems = [], info.roles = {}; else delete info.images;
const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }, s);
// Contrast against what is really behind the words: hide the letters, photograph the ad, and compare each text's colour with the pixels under it.
// The darkest tenth (for light text, the lightest) must still reach 7 to 1, the skill's rule for reading in sunlight. Shadows and outlines are ignored.
if (!full && Object.keys(info.roles).length) {
  await send('Runtime.evaluate', { expression: `document.head.insertAdjacentHTML('beforeend','<style id=__nc>*{color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important}</style>')` }, s);
  const bare = await send('Page.captureScreenshot', { format: 'png' }, s);
  await send('Runtime.evaluate', { expression: `document.getElementById('__nc').remove()` }, s);
  const check = `(async () => { const img = new Image(); img.src = 'data:image/png;base64,${bare.data}'; await img.decode();
    const cv = document.createElement('canvas'); cv.width = ${W}; cv.height = ${H}; const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4, lum = (r, gr, b) => 0.2126 * lin(r) + 0.7152 * lin(gr) + 0.0722 * lin(b), out = [];
    for (const e of document.querySelectorAll('body *')) { const nodes = [...e.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()); if (!nodes.length || e.closest('[aria-hidden=true]')) continue;
      const c = getComputedStyle(e), m = c.color.match(/[\\d.]+/g).map(Number); if (m.length > 3 && m[3] === 0) continue; const tl = lum(m[0], m[1], m[2]), ratios = [];
      for (const n of nodes) { const rg = document.createRange(); rg.selectNodeContents(n); for (const r of rg.getClientRects()) { const x = Math.max(0, Math.floor(r.left)), y = Math.max(0, Math.floor(r.top)), w = Math.min(${W}, Math.ceil(r.right)) - x, h = Math.min(${H}, Math.ceil(r.bottom)) - y; if (w < 2 || h < 2) continue;
        const d = g.getImageData(x, y, w, h).data; for (let i = 0; i < d.length; i += 4 * 7) { const bl = lum(d[i], d[i + 1], d[i + 2]); ratios.push((Math.max(bl, tl) + 0.05) / (Math.min(bl, tl) + 0.05)); } } }
      if (!ratios.length) continue; ratios.sort((a, b) => a - b); const worst = ratios[Math.floor(ratios.length / 10)];
      if (worst < 7) out.push('contrast ' + worst.toFixed(1) + ' to 1 behind the words, under 7 to 1: ' + (e.innerText || e.textContent).trim().replace(/\\s+/g, ' ').slice(0, 40)); }
    return out; })()`;
  const c = await send('Runtime.evaluate', { expression: check, awaitPromise: true, returnByValue: true }, s);
  info.problems.push(...(c.result.value ?? ['contrast check failed']));
}
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(JSON.stringify({ out, size: `${W}x${H}`, ...info }, null, 1));
finish(0);
