// Shared by the tests: a copy of the plugin in a folder with a space in its name (where an uploaded plugin lives),
// a made-up run on disk, and a throwaway headless browser.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
export const LINES = ['message_clear_3s', 'exact_copy', 'hierarchy', 'legibility_phone', 'text_amount', 'photo_colour', 'overlay_craft', 'place', 'brand_fit', 'ambition', 'desire', 'owner_would_pay']

/** The plugin's skills copied under "<tmp>/My Plugins/parival by grownoli/". */
export function pluginCopy() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parival-test-')), 'My Plugins', 'parival by grownoli')
  fs.cpSync(path.join(ROOT, 'skills'), path.join(dir, 'skills'), { recursive: true })
  for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f))
  return dir
}

/** A PNG of one flat colour, valid enough for a browser and for sips. */
export function png(w, h, [r, g, b]) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const body = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body)); return Buffer.concat([len, body, crc]) }
  const head = Buffer.alloc(13); head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 2
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(w * 3, Buffer.from([r, g, b]))])
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(h).fill(row)))), chunk('IEND', Buffer.alloc(0))])
}

export const critique = (score, defects = []) => ({ scores: Object.fromEntries(LINES.map((l) => [l, score])), evidence: Object.fromEntries(LINES.map((l) => [l, 'seen'])), defects, plain_or_template: 'plain' })

/** A runs folder holding one run of two ads in five formats, each with one rendered loop. */
export function fakeRuns({ loops = 1 } = {}) {
  const runs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'parival-runs-')), 'My Ads', 'runs')
  const set = path.join(runs, '2026-11-23-spring-sale', 'harbour-bakery')
  const sizes = { '1x1': [108, 108], '3x4': [108, 144], '9x16': [108, 192], '16x9': [192, 108], '4x3': [144, 108] }
  const briefs = []
  for (const ad of ['bread', 'coffee']) for (const [size, [w, h]] of Object.entries(sizes)) {
    const format = `${size}-${ad}`
    briefs.push({ format, brand: 'Harbour Bakery', headline: ad === 'bread' ? 'Warm bread from six every morning' : 'Coffee on the quay', goal: 'visit' })
    for (let n = 1; n <= loops; n++) {
      const dir = path.join(set, format, `loop-${n}`)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'ad.html'), `<!doctype html><body style="margin:0;background:#123a6b">${format} ${n}</body>`)
      fs.writeFileSync(path.join(dir, 'ad.png'), png(w, h, [18 + n * 40, 58, 107]))
    }
  }
  fs.writeFileSync(path.join(set, '..', 'run.json'), JSON.stringify({ title: 'Vårrea på kajen' }))
  fs.writeFileSync(path.join(set, 'briefs.json'), JSON.stringify(briefs))
  fs.writeFileSync(path.join(set, 'manifest.json'), JSON.stringify(briefs.map((b) => ({ format: b.format, company: b.brand, headline: b.headline }))))
  return { runs, set }
}

const CHROME = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/google-chrome', '/usr/bin/chromium'].find((c) => c && fs.existsSync(c))

/** A headless browser page with a throwaway profile: evaluate(), screenshot(), and every address it asked for in `requests`. */
export async function browser(url, { width = 1500, height = 780, dark = false } = {}) {
  if (!CHROME) throw new Error('No browser found. Install Chrome or set CHROME_BIN.')
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'parival-chrome-'))
  const proc = spawn(CHROME, ['--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--disable-extensions', '--hide-scrollbars', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] })
  const ws = await new Promise((res) => { let b = ''; proc.stderr.on('data', (d) => { b += d; const m = b.match(/DevTools listening on (ws:\S+)/); if (m) res(m[1]) }) })
  const sock = new WebSocket(ws); await new Promise((r) => (sock.onopen = r))
  let id = 0; const pending = new Map(), requests = []
  sock.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } else if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url) }
  const send = (method, params = {}, sessionId) => new Promise((res, rej) => { pending.set(++id, { res, rej }); sock.send(JSON.stringify({ id, method, params, sessionId })) })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }), { sessionId: s } = await send('Target.attachToTarget', { targetId, flatten: true })
  await send('Page.enable', {}, s); await send('Network.enable', {}, s); await send('Runtime.enable', {}, s)
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 }, s)
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] }, s)
  await send('Page.navigate', { url }, s)
  const evaluate = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
  const until = async (expression, ms = 8000) => { for (const t = Date.now(); Date.now() - t < ms;) { if (await evaluate(expression).catch(() => false)) return true; await new Promise((r) => setTimeout(r, 100)) } throw new Error(`never true: ${expression}`) }
  return { evaluate, until, requests,
    screenshot: async (file) => fs.writeFileSync(file, Buffer.from((await send('Page.captureScreenshot', { format: 'png' }, s)).data, 'base64')),
    close: () => { proc.kill('SIGKILL'); setTimeout(() => fs.rmSync(profile, { recursive: true, force: true }), 300) } }
}
