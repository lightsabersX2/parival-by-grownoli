// The local page's server: it listens on this machine only, answers only its own address, serves pictures but never an
// ad's HTML or a file outside the runs folder, saves a comment, and hands the comment back to Claude.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fakeRuns, pluginCopy } from './helpers.mjs'

const PAGE = path.join(pluginCopy(), 'skills', 'local-page', 'scripts', 'page.mjs')
const page = (...args) => JSON.parse(execFileSync(process.execPath, [PAGE, ...args], { encoding: 'utf8' }))
const { runs, set } = fakeRuns({ loops: 2 })
const { address } = page('start', runs, '--no-open', '--port', '5391')
test.after(() => page('stop', runs))
const port = new URL(address).port
const post = (p, body, headers = {}) => fetch(address + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
const ID = '2026-11-23-spring-sale/harbour-bakery'

test('listens on the loopback address only', () => {
  assert.match(address, /^http:\/\/127\.0\.0\.1:\d+\/$/)
  const listening = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split('\n').slice(1)
  assert.ok(listening.length > 0 && listening.every((l) => l.includes(`127.0.0.1:${port}`)), listening.join('\n'))
  const lan = Object.values(os.networkInterfaces()).flat().find((i) => i.family === 'IPv4' && !i.internal)?.address
  if (lan) return assert.rejects(fetch(`http://${lan}:${port}/`, { signal: AbortSignal.timeout(1500) }), 'the Mac\'s own network address does not answer')
})

test('the page outlives the plugin folder it was started from', async () => {
  // a plugin loaded for one session is unpacked in a temporary folder that is removed when the session ends
  const gone = pluginCopy(), runs2 = fakeRuns().runs
  const started = JSON.parse(execFileSync(process.execPath, [path.join(gone, 'skills', 'local-page', 'scripts', 'page.mjs'), 'start', runs2, '--no-open', '--port', '5393'], { encoding: 'utf8' }))
  fs.rmSync(gone, { recursive: true, force: true })
  const html = await fetch(started.address)
  assert.equal(html.status, 200)
  const asset = /src="(\/assets\/[^"]+\.js)"/.exec(await html.text())[1]
  assert.equal((await fetch(started.address + asset.slice(1))).status, 200)
  process.kill(JSON.parse(fs.readFileSync(path.join(runs2, '.parival', 'page.json'), 'utf8')).pid)
})

test('a second start finds the page already running', () => {
  assert.equal(page('start', runs, '--no-open').already_running, true)
})

test('answers only its own address', async () => {
  const r = await new Promise((res) => import('node:http').then(({ request }) => request({ host: '127.0.0.1', port, path: '/api/list', headers: { Host: 'evil.example' } }, res).end()))
  assert.equal(r.statusCode, 403)
  assert.equal((await post('api/feedback', { set: ID, setNote: 'x' }, { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await fetch(address + 'api/feedback', { method: 'POST', body: '{}' })).status, 415, 'a form post from another page is refused')
})

test('lists the run with every format and loop', async () => {
  const [project] = await (await fetch(address + 'api/list')).json()
  assert.equal(project.name, 'Harbour Bakery')
  const [s] = project.sets
  assert.equal(s.label, 'Vårrea på kajen', 'the run shows the title it was given, with its own letters')
  assert.equal(s.ads.length, 10)
  assert.deepEqual(s.ads.slice(0, 5).map((a) => a.format), ['1x1-bread', '3x4-bread', '9x16-bread', '16x9-bread', '4x3-bread'], 'the five formats of one ad stay together')
  assert.ok(s.ads.every((a) => a.rounds.length === 2))
})

test('serves pictures, never an ad\'s HTML, a hidden file or a file outside the runs folder', async () => {
  const file = (rel) => fetch(`${address}api/file?path=${encodeURIComponent(rel)}`)
  assert.equal((await file(`${ID}/1x1-bread/loop-1/ad.png`)).headers.get('content-type'), 'image/png')
  assert.equal((await file(`${ID}/1x1-bread/loop-1/ad.html`)).status, 404)
  assert.equal((await file('.parival/page.json')).status, 404)
  fs.writeFileSync(path.join(runs, '..', 'secret.json'), '{}')
  assert.equal((await file('../secret.json')).status, 404)
  assert.equal((await fetch(address + '..%2Fscripts%2Fpage.mjs')).status, 404)
})

test('the licence and the third-party notices are served as readable text', async () => {
  const licence = await fetch(address + 'about/licence.txt')
  assert.match(licence.headers.get('content-type'), /^text\/plain/)
  assert.match(await licence.text(), /Apache License\s+Version 2\.0/)
  const notices = await (await fetch(address + 'about/third-party-notices.txt')).text()
  for (const part of ['Vue', 'marked', 'DOMPurify', 'Tailwind CSS', 'Bricolage Grotesque', 'DM Sans', 'SIL Open Font License']) assert.ok(notices.includes(part), part)
})

test('the page forbids every address but its own', async () => {
  const csp = (await fetch(address)).headers.get('content-security-policy')
  assert.match(csp, /default-src 'self'/)
  assert.match(csp, /connect-src 'self'/)
  assert.doesNotMatch(csp, /https?:|\*/)
})

test('a comment saved on the page is read back by the comments command', async () => {
  assert.equal(page('comments', runs).runs.length, 0)
  assert.equal((await post('api/feedback', { set: ID, format: '1x1-bread', round: 2, latest: 2, rating: 'up', note: 'Make the bread larger.', pins: [{ id: 'a', x: 0.25, y: 0.8, text: 'The logo is too close to the edge.' }] })).status, 200)
  assert.equal((await post('api/feedback', { set: '../harbour-bakery', setNote: 'x' })).status, 400, 'only a set\'s own folder is written to')
  const [r] = page('comments', runs).runs
  assert.equal(r.set, path.join(runs, ID))
  const v = r.ads[0].versions[0]
  assert.deepEqual([r.ads[0].format, v.version, v.rating, v.note], ['1x1-bread', 2, 'up', 'Make the bread larger.'])
  assert.deepEqual(v.comments_on_the_image, [{ text: 'The logo is too close to the edge.', from_left: '25%', from_top: '80%' }])
  assert.equal(v.html, path.join(set, '1x1-bread', 'loop-2', 'ad.html'))
  assert.deepEqual(fs.readdirSync(set).filter((f) => f.endsWith('.json')).sort(), ['briefs.json', 'feedback.json', 'manifest.json'], 'feedback.json is the only file the page wrote')
})
