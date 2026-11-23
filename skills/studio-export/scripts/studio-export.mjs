#!/usr/bin/env node
// Turns one HTML ad into a project file that Grownoli Studio can import.
// usage: node studio-export.mjs <ad.html> <out.zip> [--size 1080x1080]
// Text becomes editable text layers with the browser's own line breaks and the ad's own font files. A logo or photo with
// a data-role becomes one picture layer. A ground of one plain colour becomes the Studio's background colour. Everything
// else is photographed in paint order as transparent pictures.
// Needs Node 22 or later and Chrome, Chromium, Edge or Brave. CHROME_BIN overrides the search.
import { fileURLToPath } from 'node:url';
import { count } from '../../local-page/scripts/counts.mjs';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import os from 'node:os'; import http from 'node:http'; import { spawn } from 'node:child_process';

const args = process.argv.slice(2), sizeAt = args.indexOf('--size');
const [input, out] = args.filter((a, i) => !a.startsWith('--') && (sizeAt < 0 || i !== sizeAt + 1));
if (!input || !out) { console.error('usage: node studio-export.mjs <ad.html> <out.zip> [--size WxH]'); process.exit(2); }
const html = fs.realpathSync(input), dir = path.dirname(html);
// The ad may use pictures and fonts kept a folder or two above it, so the page is served from up to three folders up,
// never from the home folder or the disk's top folder.
let root = dir; for (let i = 0; i < 3; i++) { const up = path.dirname(root); if (up === os.homedir() || path.dirname(up) === up || up === fs.realpathSync(os.tmpdir())) break; root = up; }
// The ad's size: --size, or the size of the PNG rendered beside it.
const png = ['final.png', 'ad.png'].map(f => path.join(dir, f)).find(f => fs.existsSync(f));
const [W, H] = sizeAt >= 0 ? args[sizeAt + 1].split('x').map(Number) : png ? [fs.readFileSync(png).readUInt32BE(16), fs.readFileSync(png).readUInt32BE(20)] : [1080, 1080];
// The canvases Grownoli Studio has, by the ad's shape: ratio name and canvas size in Studio units.
const CANVASES = [['1:1', 1080, 1080], ['3:4', 1080, 1440], ['9:16', 1080, 1920], ['16:9', 1080, 608], ['4:3', 1080, 810]];
const canvas = CANVASES.find(([, cw, ch]) => Math.abs(ch - H * cw / W) <= 1);
if (!canvas) { console.error(`Grownoli Studio has no canvas shaped ${W}x${H}. It has 1:1, 3:4, 9:16, 16:9 and 4:3.`); process.exit(2); }
const [aspect, CW, CH] = canvas, k = CW / W, PX = 2; // PX: picture pixels per Studio unit
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANALYSE = fs.readFileSync(path.join(HERE, 'analyse.mjs'), 'utf8'), BASE = JSON.parse(fs.readFileSync(path.join(HERE, 'blank.json'), 'utf8'));
const CHROME = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(c => c && fs.existsSync(c));
if (!CHROME) { console.error('No browser found. Install Chrome or set CHROME_BIN.'); process.exit(2); }

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };

/** Serves the out folder from one origin, so the page loads its own photos and fonts and canvases stay untainted. */
function serve(mounts) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const prefix = Object.keys(mounts).find(p => url.startsWith(p));
    const file = prefix && path.join(mounts[prefix], url.slice(prefix.length));
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}


// --- small helpers ---
const hex = c => { const m = c.match(/[\d.]+/g).map(Number); return { hex: '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join(''), alpha: m[3] ?? 1 }; };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const bucket = w => [[300, 'light'], [400, 'normal'], [700, 'bold'], [900, 'extra-bold']].reduce((a, b) => (Math.abs(b[0] - w) < Math.abs(a[0] - w) ? b : a))[1];
const noShadow = { blur: 0, color: '#000000', offsetX: 0, offsetY: 0, opacity: 0 };
function zip(files) { // Stored, no compression: the images inside are already compressed.
  const parts = [], central = []; let offset = 0;
  for (const [name, data] of files) { const n = Buffer.from(name), crc = zlib.crc32(data), h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(offset, 42);
    parts.push(h, n, data); central.push(c, n); offset += 30 + n.length + data.length; }
  const cd = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-export-'))
  const proc = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--disable-extensions', '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const srv = await serve({ '/': root + '/' })
  try {
    const ws = await new Promise((res, rej) => { let b = ''; proc.on('error', rej); proc.stderr.on('data', d => { b += d; const m = b.match(/DevTools listening on (ws:\S+)/); if (m) res(m[1]) }) })
    const sock = new WebSocket(ws); await new Promise(r => (sock.onopen = r))
    let seq = 0; const pending = new Map(), loads = new Set()
sock.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Page.loadEventFired') loads.add(m.sessionId); };
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { pending.set(++seq, { res, rej }); sock.send(JSON.stringify({ id: seq, method, params, sessionId })); });
async function openPage(url, width, height, scale) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, s); await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false }, s);
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, s);
  loads.delete(s); await send('Page.navigate', { url }, s); for (const t = Date.now(); !loads.has(s) && Date.now() - t < 15000;) await new Promise(r => setTimeout(r, 30));
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  return { evaluate, shot: async () => (await send('Page.captureScreenshot', { format: 'png' }, s)).data, close: () => send('Target.closeTarget', { targetId }) };
}
    const tool = await openPage('about:blank', 100, 100, 1)
// Crops a transparent screenshot to what it actually painted and returns it as WebP with its box, in screenshot pixels.
const trim = png => tool.evaluate(`(async () => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,${png}')).blob());
  const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
  let l = c.width, t = c.height, r = -1, b = -1; for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 2) { if (i < l) l = i; if (i > r) r = i; if (y < t) t = y; if (y > b) b = y; }
  if (r < 0) return null; const o = new OffscreenCanvas(r - l + 1, b - t + 1); o.getContext('2d').drawImage(c, -l, -t);
  const buf = await (await o.convertToBlob({ type: 'image/webp', quality: 0.92 })).arrayBuffer(); let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768));
  return { x: l, y: t, w: o.width, h: o.height, url: 'data:image/webp;base64,' + btoa(s) }; })()`);
    const page = await openPage(`${srv.origin}/${path.relative(root, html).split(path.sep).map(encodeURIComponent).join('/')}`, W, H, PX * k)
  const a = await page.evaluate(ANALYSE), notes = [...a.notes], layers = [], fonts = new Map(), fontFiles = [];
  // A ground of one plain colour goes to the Studio as its own background colour, so the Studio's Background panel changes
  // it and another format is filled with it. Only a ground that is not one colour stays a flat picture, which arrives locked.
  const plain = png => tool.evaluate(`(async () => { const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,${png}')).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height), x = c.getContext('2d'); x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 255 || Math.abs(d[i] - d[0]) > 1 || Math.abs(d[i + 1] - d[1]) > 1 || Math.abs(d[i + 2] - d[2]) > 1) return null;
    return '#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join(''); })()`);
  let ground = null; // the lowest things painted, as long as each covers the whole ad in one opaque colour
  while (a.units[0]?.kind === 'raster') { await page.evaluate(`__show(${JSON.stringify([a.units[0].el])}, true)`); const c = await plain(await page.shot()); if (!c) break; ground = c; a.units.shift(); }
  const picture = async (id, idx, noText) => { await page.evaluate(`__show(${JSON.stringify(idx)}, ${noText})`); const t = await trim(await page.shot()); if (!t) return;
    layers.push({ image: { id, url: t.url, visible: true, xOffset: t.x / PX, yOffset: t.y / PX, width: t.w / PX, height: t.h / PX, rotation: 0, opacity: 1, maskEnabled: false } }); };

  // A font with an optical-size axis picks its letter shapes from the type size. The canvas draws at another size than the page, so hold the page's.
  const opticalSize = (st, px) => k === 1 ? 0 : page.evaluate(`(([fam, w, it, px]) => { const m = o => { const e = document.createElement('span'); e.textContent = 'Hamburgefonstiv';
    e.style.cssText = 'position:absolute;white-space:nowrap;font:' + (it ? 'italic ' : '') + w + ' ' + px + 'px "' + fam + '";font-optical-sizing:' + o; document.body.append(e); const x = e.getBoundingClientRect().width; e.remove(); return x; };
    return Math.abs(m('auto') - m('none')) > 0.01 ? Math.round(px) : 0; })(${JSON.stringify([st.family, st.weight, st.italic, px])})`);
  const fontFor = async (st, px) => { // One Grownoli custom font per font file the ad ships, and per optical size where the font has that axis.
    const faces = a.faces.filter(f => f.family.toLowerCase() === st.family.toLowerCase() && (f.style === 'italic') === st.italic);
    const pool = faces.length ? faces : a.faces.filter(f => f.family.toLowerCase() === st.family.toLowerCase());
    const face = pool.find(f => { const [lo, hi = lo] = f.weight.split(' ').map(Number); return st.weight >= lo && st.weight <= hi; })
      || pool.sort((x, y) => Math.abs(parseInt(x.weight) - st.weight) - Math.abs(parseInt(y.weight) - st.weight))[0];
    if (!face) { notes.push(`font "${st.family}" has no font file in the ad, so Grownoli falls back to its default`); return { value: 'sans', italic: st.italic }; }
    const opsz = await opticalSize(st, px), id = (face.url || `local:${face.local}`) + (opsz ? `#${opsz}` : '');
    if (!fonts.has(id)) { const name = `${slug(face.family)}-${slug(face.weight)}${face.style === 'italic' ? '-italic' : ''}`;
      const entry = { value: `custom:parival-${name}${opsz ? '-opsz' + opsz : ''}`, label: `${face.family}${face.weight.includes(' ') ? '' : ' ' + face.weight}${face.style === 'italic' ? ' Italic' : ''}${opsz ? ' ' + opsz : ''}`, weightRange: face.weight, ...(opsz ? { opticalSize: opsz } : {}) };
      if (face.url) { const file = decodeURIComponent(new URL(face.url).pathname), ext = path.extname(file).toLowerCase();
        entry.file = `fonts/${name}${ext}`; if (!fontFiles.some(f => f[0] === entry.file)) fontFiles.push([entry.file, fs.readFileSync(path.join(root, file))]); }
      else { entry.local = face.local; notes.push(`font "${face.family}" is "${face.local}" installed on this Mac, with no file in the ad: another computer shows a fallback, as it would for the HTML`); }
      fonts.set(id, entry); }
    if (!faces.length && st.italic) notes.push(`font "${st.family}" ships no italic file, so the browser slants the upright one`);
    return { value: fonts.get(id).value, italic: st.italic && face.style !== 'italic' };
  };

  let run = [], n = 0; const flush = async () => { if (run.length) await picture(`custom_img_picture_${++n}`, run, true); run = []; };
  for (const u of a.units) {
    if (u.kind === 'raster') { run.push(u.el); continue; }
    await flush();
    if (u.kind === 'image') { await picture(`custom_img_${u.role}_${++n}`, [u.el], true); if (Math.abs(u.rotation) > 0.1) notes.push(`${u.role}: rotation is baked into the picture`); continue; }
    const st = u.st, col = hex(st.color), f = await fontFor(st, st.size * u.k), fs_ = st.size * u.k * k;
    // The CSS text box, with a little slack so Konva never re-wraps or drops a line.
    const sw = u.w * k * 0.06 + 8, sh = fs_ * 0.4, // less slack than this dropped a word at import: Konva measured one line wider than Chrome
    iw = u.w * k + sw, ih = Math.max(u.h * k, u.lines * fs_ * u.lineHeight) + sh;
    const shift = u.align === 'left' ? sw / 2 : u.align === 'right' ? -sw / 2 : 0, rad = u.rotation * Math.PI / 180;
    const cx = u.cx * k + shift * Math.cos(rad), cy = u.cy * k + shift * Math.sin(rad), pad = 0; // the text layer carries textInset 0, so its box is the text's own box plus the slack
    // A single CSS text-shadow maps onto Grownoli's one shadow per layer.
    const sm = st.shadow && !st.shadow.includes('),') && st.shadow.match(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/), sc = sm && hex(sm[1]);
    if (st.shadow && !sm) notes.push(`${u.name}: stacked text-shadow is not carried over`);
    layers.push({ shape: { id: `${u.role || 'text'}-${++n}`, componentRole: ['headline', 'subheadline', 'cta', 'badge'].includes(u.role) ? u.role : 'text', text: u.text, shapeType: 'text',
      fillColor: 'transparent', textColor: col.hex, font: f.value, weight: bucket(st.weight), fontWeightValue: st.weight, italic: f.italic, underline: st.underline,
      fontSize: +fs_.toFixed(2), letterSpacing: st.letterSpacing, lineHeight: +u.lineHeight.toFixed(3), textInset: 0, align: u.align, borderWidth: 0, borderColor: '#000000', cornerRadius: 0,
      shadow: sm ? { color: sc.hex, opacity: sc.alpha, offsetX: +sm[2] * u.k * k, offsetY: +sm[3] * u.k * k, blur: +sm[4] * u.k * k } : noShadow, size: 1, x: cx - iw / 2 - pad, y: cy - ih / 2 - pad, width: iw + 2 * pad, height: ih + 2 * pad, rotation: u.rotation, opacity: col.alpha, visible: true } });
  }
  await flush(); await page.close();
  const config = { ...structuredClone(BASE), ...(ground && { backgroundEffects: { ...BASE.backgroundEffects, backgroundColor: ground } }), messageShapes: layers.filter(l => l.shape).map(l => l.shape), customImages: layers.filter(l => l.image).map(l => l.image),
    layerOrder: [...(BASE.layerOrder || []), ...layers.map(l => (l.shape || l.image).id)],
    // A decoration that covers most of the canvas, such as a gradient over the photo, would catch every click meant
    // for the photo under it. It arrives locked; the Layers panel unlocks it.
    lockedLayers: [...(BASE.lockedLayers || []), ...layers.filter(l => l.image && /^custom_img_picture_/.test(l.image.id) && l.image.width * l.image.height > 0.4 * CW * CH).map(l => l.image.id)] };
    const data = { config, generationParams: { aspectRatio: aspect, prompt: '', seed: null, model: 'flash' }, fonts: [...fonts.values()], notes: [...new Set(notes)] };
    fs.writeFileSync(out, zip([['project-data.json', Buffer.from(JSON.stringify(data))], ...fontFiles]));
    count({ studioExports: 1 });
    console.log(JSON.stringify({ file: path.resolve(out), canvas: aspect, background: ground ?? 'a locked picture layer, or none', textLayers: config.messageShapes.filter(s => s.visible).length, pictureLayers: config.customImages.length, fonts: fonts.size, notes: data.notes }, null, 1));
  } catch (e) { count({ error: 'export_failed' }); throw e;
  } finally {
    proc.kill('SIGKILL'); srv.close(); setTimeout(() => { fs.rmSync(profile, { recursive: true, force: true }); process.exit(process.exitCode ?? 0); }, 300);
  }
