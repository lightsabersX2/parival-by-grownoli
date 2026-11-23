// The local page's server and its commands, bundled into skills/local-page/scripts/page.mjs. It needs Node 22 and nothing
// else. It listens on 127.0.0.1 only, answers only requests addressed to this machine's own page, serves the runs
// folder read-only, and writes one kind of file: feedback.json in a set's folder. It makes no request of its own.
//   node page.mjs start <runs folder> [--port 5290] [--no-open]   starts the page if it is not running, opens it, prints its address
//   node page.mjs stop <runs folder>                              stops it
//   node page.mjs comments <runs folder> [--all]                  prints every rating, note and pinned comment the person left
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { spawn, execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { byVersion } from './feedback.ts'
import { scanOut } from './scan.ts'
import { fileInOut, revealPaths, saveFeedback } from './store.ts'
import { thumbnail } from './thumb.ts'

const SELF = fileURLToPath(import.meta.url)
const APP = join(dirname(SELF), '..', 'app')
const IDLE_MS = 60 * 60_000
const TYPES: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', woff2: 'font/woff2', woff: 'font/woff', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', md: 'text/plain; charset=utf-8', json: 'application/json', txt: 'text/plain; charset=utf-8' }
/** Files of a run the page may show: pictures, notes and data. An ad's HTML is never served. */
const RUN_FILES = new Set(['png', 'jpg', 'jpeg', 'webp', 'md', 'json'])
// the page loads only its own files and talks only to its own address
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"

const statePath = (runs: string) => join(runs, '.parival', 'page.json')
const readState = (runs: string): { pid: number; port: number } | null => { try { return JSON.parse(readFileSync(statePath(runs), 'utf8')) } catch { return null } }
const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
const url = (port: number) => `http://127.0.0.1:${port}/`
async function answers(port: number, runs: string) {
  try { const r = await fetch(`${url(port)}api/ping`, { signal: AbortSignal.timeout(1500) }); return r.ok && ((await r.json()) as { runs?: string }).runs === runs } catch { return false }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of req) {
    raw += chunk
    if (raw.length > 100_000) throw new Error('too large')
  }
  return JSON.parse(raw || '{}')
}

function serve(runs: string, first: number) {
  const thumbs = join(tmpdir(), 'parival-thumbs')
  // The page's own files are read into memory once. A plugin loaded for one session is unpacked in a temporary folder
  // that goes away when the session ends, and the page must outlive it.
  const app = new Map<string, Buffer>()
  for (const f of readdirSync(APP, { recursive: true, withFileTypes: true })) if (f.isFile()) app.set('/' + relative(APP, join(f.parentPath, f.name)).split('\\').join('/'), readFileSync(join(f.parentPath, f.name)))
  let port = first
  let last = Date.now()
  // the plugin's licence and notices, read once for the same reason, so About can show them
  const ROOT = join(dirname(SELF), '..', '..', '..')
  for (const [name, file] of [['/about/licence.txt', 'LICENSE'], ['/about/third-party-notices.txt', 'THIRD_PARTY_NOTICES.md']]) {
    try { app.set(name, readFileSync(join(ROOT, file))) } catch { /* a copy without the file has no such page */ }
  }
  async function api(req: IncomingMessage, res: ServerResponse, path: string, query: URLSearchParams) {
    const post = req.method === 'POST'
    if (post && req.headers['content-type'] !== 'application/json') return send(res, 415, { error: 'json only' })
    if (post && req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(res, 403, { error: 'wrong origin' })
    if (path === '/ping') return send(res, 200, { runs })
    if (path === '/list') return send(res, 200, await scanOut(runs))
    if (path === '/file') {
      const rel = query.get('path') ?? ''
      const ext = rel.split('.').pop()?.toLowerCase() ?? ''
      let file = RUN_FILES.has(ext) && !rel.split('/').some((p) => p.startsWith('.')) ? await fileInOut(runs, rel) : null
      if (!file) return send(res, 404, { error: 'not found' })
      let type = TYPES[ext]
      // `small` sends a JPEG at most 960 pixels on its longest side, for the rows; the full file is for enlarging
      const small = query.has('small') && ext === 'png' ? await thumbnail(file, 960, thumbs) : null
      if (small) [file, type] = [small, 'image/jpeg']
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' })
      return void createReadStream(file).pipe(res)
    }
    if (path === '/feedback' && post) {
      const { set, ...patch } = await body(req)
      return send(res, 200, await saveFeedback(runs, String(set), patch))
    }
    if (path === '/reveal' && post) {
      const { paths } = await body(req)
      const found = Array.isArray(paths) ? await revealPaths(runs, paths.map(String)) : null
      if (!found) return send(res, 404, { error: 'not found' })
      // a folder opens as a window; a file is selected in its folder
      const isDir = (await stat(found[0])).isDirectory()
      if (process.platform === 'darwin') execFile('open', isDir ? [found[0]] : ['-R', found[0]], () => {})
      else if (process.platform === 'win32') execFile('explorer', [isDir ? found[0] : dirname(found[0])], () => {})
      else execFile('xdg-open', [isDir ? found[0] : dirname(found[0])], () => {})
      return send(res, 200, { ok: true })
    }
    send(res, 404, { error: 'not found' })
  }
  const server = createServer((req, res) => {
    last = Date.now()
    const u = new URL(req.url ?? '/', 'http://x')
    // a page on another site cannot reach this one by a made-up name: only the page's own address is answered
    if (req.headers.host !== `127.0.0.1:${port}` && req.headers.host !== `localhost:${port}`) return send(res, 403, { error: 'wrong host' })
    if (u.pathname.startsWith('/api/')) return void api(req, res, u.pathname.slice(4), u.searchParams).catch((e: Error) => send(res, /not a set/.test(e.message) ? 400 : 500, { error: e.message }))
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'read only' })
    const name = u.pathname === '/' ? '/index.html' : u.pathname
    const file = app.get(name)
    const type = TYPES[extname(name).slice(1).toLowerCase()]
    if (!file || !type) return send(res, 404, { error: 'not found' })
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': u.pathname.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache', 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' })
    res.end(file)
  })
  server.on('error', (e: NodeJS.ErrnoException) => {
    if (e.code === 'EADDRINUSE' && port < first + 20) server.listen(++port, '127.0.0.1')
    else { console.error(e.message); process.exit(1) }
  })
  server.on('listening', () => {
    mkdirSync(dirname(statePath(runs)), { recursive: true })
    writeFileSync(statePath(runs), JSON.stringify({ pid: process.pid, port }))
  })
  server.listen(port, '127.0.0.1')
  // closes by itself an hour after the last request; an open page asks every ten seconds, so it stays up while in use
  setInterval(() => { if (Date.now() - last > IDLE_MS) { rmSync(statePath(runs), { force: true }); process.exit(0) } }, 60_000).unref()
  for (const s of ['SIGTERM', 'SIGINT'] as const) process.on(s, () => { rmSync(statePath(runs), { force: true }); process.exit(0) })
}

/** Everything the person left on the page, per run: ratings, notes and comments pinned to a spot, with the file each is about. */
async function comments(runs: string, all: boolean) {
  const out = []
  for (const p of await scanOut(runs)) for (const s of p.sets) {
    const ads = []
    for (const ad of s.ads) {
      const versions = Object.entries(byVersion(s.feedback.ads[ad.format], s.maxRound)).map(([n, v]) => {
        const round = ad.rounds.find((r) => r.n === Number(n))
        return {
          version: Number(n), ...(v.rating && { rating: v.rating }), ...(v.note && { note: v.note }),
          ...(v.pins?.length && { comments_on_the_image: v.pins.map((pin) => ({ text: pin.text, from_left: `${Math.round(pin.x * 100)}%`, from_top: `${Math.round(pin.y * 100)}%` })) }),
          ...(round && { image: join(runs, round.image), html: join(runs, round.image.replace(/ad\.png$/, 'ad.html')) }),
        }
      })
      if (versions.length) ads.push({ format: ad.format, newest_version: ad.rounds[ad.rounds.length - 1].n, versions })
    }
    const fb = s.feedback
    if (!all && !ads.length && !fb.set_note && !fb.set_rating) continue
    out.push({ brand: p.name, set: join(runs, s.id), ...(fb.updated && { updated: fb.updated }), ...(fb.set_rating && { run_rating: fb.set_rating }), ...(fb.set_note && { run_note: fb.set_note }), ads })
  }
  return { ratings: { star: 'Locked. Keep this version as it is.', up: 'Good direction. Build on this version.', down: 'Wrong direction, or disliked. Move away from it.' }, runs: out }
}

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
const folder = rest.find((a, i) => !a.startsWith('--') && rest[i - 1] !== '--port')
const runs = folder ? resolve(folder) : ''
const print = (o: unknown) => console.log(JSON.stringify(o, null, 1))
if (!cmd || !runs || !['start', 'stop', 'comments', 'serve'].includes(cmd)) {
  console.error('usage: node page.mjs start|stop|comments <runs folder> [--port 5290] [--no-open] [--all]')
  process.exit(2)
}
if (cmd !== 'stop' && !existsSync(runs)) { console.error(`No such folder: ${runs}`); process.exit(2) }

if (cmd === 'serve') serve(runs, Number(flag('--port')) || 5290)
else if (cmd === 'comments') print(await comments(runs, rest.includes('--all')))
else if (cmd === 'stop') {
  const s = readState(runs)
  if (s && alive(s.pid) && (await answers(s.port, runs))) process.kill(s.pid)
  rmSync(statePath(runs), { force: true })
  print({ stopped: !!s })
} else {
  let s = readState(runs)
  const running = !!s && alive(s.pid) && (await answers(s.port, runs))
  if (!running) {
    rmSync(statePath(runs), { force: true })
    spawn(process.execPath, [SELF, 'serve', runs, '--port', flag('--port') ?? '5290'], { detached: true, stdio: 'ignore' }).unref()
    for (let i = 0; i < 50 && !((s = readState(runs)) && (await answers(s.port, runs))); i++) await new Promise((r) => setTimeout(r, 100))
    if (!s) { console.error('The page did not start. Check that Node 22 or later runs this script.'); process.exit(1) }
  }
  const address = url(s!.port)
  if (!rest.includes('--no-open')) {
    if (process.platform === 'darwin') execFile('open', [address], () => {})
    else if (process.platform === 'win32') execFile('cmd', ['/c', 'start', '', address], () => {})
    else execFile('xdg-open', [address], () => {})
  }
  print({ address, runs, already_running: running, opened_in_browser: !rest.includes('--no-open'), stops: 'by itself after an hour without a visit' })
}
