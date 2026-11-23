// Statistics, the version check and the donation schedule, tested where they leave or decide: the bytes a receiver gets,
// the files in Parival's folder, and the server's answer to "may the ask show now?".
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

// a receiver standing in for Grownoli: it keeps every request it gets
const got = []
let answer = 200 // what the stand-in says to a report
const receiver = http.createServer((req, res) => {
  let body = ''
  req.on('data', (d) => (body += d))
  req.on('end', () => { got.push({ method: req.method, url: req.url, headers: req.headers, body }); const check = req.url.startsWith('/plugin/version'); res.writeHead(check ? 200 : answer, { 'Content-Type': 'application/json' }); res.end(check ? '{"latest":"9.9.9","updateAvailable":true}' : answer === 400 ? '{"error":"Invalid report"}' : answer === 202 ? '{"ok":true,"skipped":"disabled"}' : '{"ok":true}') })
})
await new Promise((r) => receiver.listen(0, '127.0.0.1', r))
process.env.PARIVAL_API = `http://127.0.0.1:${receiver.address().port}`
const { addRun, critique, fakeRuns, pluginCopy } = await import('./helpers.mjs')
const HOME = process.env.PARIVAL_HOME
const PLUGIN = pluginCopy()
const node = (script, ...args) => JSON.parse(execFileSync(process.execPath, [path.join(PLUGIN, 'skills', ...script), ...args], { encoding: 'utf8' }))
const page = (...args) => node(['local-page', 'scripts', 'page.mjs'], ...args)
const run = (...args) => node(['campaign-run', 'scripts', 'run.mjs'], ...args)
const settings = () => JSON.parse(fs.readFileSync(path.join(HOME, 'settings.json'), 'utf8'))
const setSettings = (change) => { const s = settings(); change(s); fs.writeFileSync(path.join(HOME, 'settings.json'), JSON.stringify(s)) }
const reports = () => got.filter((g) => g.url === '/plugin/statistics')
const settle = () => new Promise((r) => setTimeout(r, 400))
const COMMENT = 'Make the bread larger, Margit said so.'

// a run with real work in it: a brand, headlines, a judged loop and a comment the person wrote
const { runs, set } = fakeRuns({ loops: 1 })
const staged = run('critique', set).start_one_fresh_subagent_per_task
for (const t of staged) for (const f of t.formats) fs.writeFileSync(path.join(t.folder, `${f}.json`), JSON.stringify(critique(3, ['headline too small'])))
run('critique-apply', set)
for (const r of Object.values(run('revise', set).revise)) fs.copyFileSync(path.join(path.dirname(r.edit), '..', 'loop-1', 'ad.png'), path.join(path.dirname(r.edit), 'ad.png'))
for (const t of run('judge', set).start_one_fresh_subagent_per_task) fs.writeFileSync(path.join(t.folder, 'verdicts.json'), JSON.stringify(Object.fromEntries(t.formats.map((f, i) => [f, { winner: ['A', 'B', 'equal'][i % 3], reason: 'clearer' }]))))
run('judge-apply', set)

const { address } = page('start', runs, '--no-open', '--port', '5397')
test.after(() => { page('stop', runs); receiver.close() })
const post = (p, body) => fetch(address + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
await post('api/feedback', { set: '2026-11-23-spring-sale/harbour-bakery', format: '1x1-bread', round: 1, latest: 2, note: COMMENT })

test('the version check carries the version and nothing else, before any notice', async () => {
  await settle()
  const checks = got.filter((g) => g.url.startsWith('/plugin/version'))
  assert.equal(checks.length, 1)
  assert.match(checks[0].url, /^\/plugin\/version\?version=\d+\.\d+\.\d+$/)
  assert.ok(!('origin' in checks[0].headers))
  assert.equal(checks[0].body, '')
  assert.ok(!('cookie' in checks[0].headers) && !('referer' in checks[0].headers))
  assert.equal((await (await fetch(address + 'api/state')).json()).latest, '9.9.9', 'About can say that a newer version exists')
})

test('nothing is reported before the notice is answered', async () => {
  assert.deepEqual(reports(), [])
  assert.match(await (await fetch(address + 'api/report')).text(), /no report until you have answered the notice/)
  assert.equal(fs.existsSync(path.join(HOME, 'settings.json')) && 'installId' in settings(), false, 'no ID exists yet')
})

test('the report holds the contract\'s fields and no site, brand, copy, file name or comment', async () => {
  await post('api/notice', { statistics: true })
  await settle()
  assert.equal(reports().length, 1)
  const sent = reports()[0].body
  assert.equal(await (await fetch(address + 'api/report')).text(), sent + '\n', 'Statistics Report shows the exact bytes that are sent')
  const r = JSON.parse(sent)
  assert.deepEqual(Object.keys(r).sort(), ['ads', 'errors', 'formats', 'installId', 'loopsEqual', 'loopsKept', 'loopsLost', 'minutesPerRun', 'node', 'os', 'pluginVersion', 'runs', 'studioExports'])
  assert.match(r.installId, /^[0-9a-f-]{36}$/)
  assert.equal(r.loopsKept + r.loopsLost + r.loopsEqual, 10, 'the ten judged revisions are counted')
  assert.ok(r.loopsEqual >= 2 && r.loopsKept >= 1 && r.loopsLost >= 1)
  for (const v of Object.values(r.errors)) assert.equal(typeof v, 'number')
  // the shapes Grownoli's API accepts; one wrong field refuses the whole report
  assert.equal(reports()[0].headers['content-type'], 'application/json')
  assert.ok(Buffer.byteLength(sent) < 8000)
  assert.match(r.pluginVersion, /^\d+\.\d+\.\d+$/)
  assert.match(r.os, /^[A-Za-z0-9 ._-]{1,40}$/)
  if (process.platform === 'darwin') assert.match(r.os, /^macOS \d+(\.\d+)*$/)
  assert.match(String(r.node), /^\d{1,3}$/)
  for (const k of ['runs', 'ads', 'formats', 'loopsKept', 'loopsLost', 'loopsEqual', 'studioExports']) assert.ok(Number.isInteger(r[k]) && r[k] >= 0, k)
  assert.equal(r.minutesPerRun, null, 'no run has finished, so there is no median to send')
  for (const code of Object.keys(r.errors)) assert.match(code, /^[a-z][a-z0-9_]{0,39}$/)
  const user = os.userInfo().username
  for (const secret of ['harbour', 'bakery', 'bread', 'coffee', 'quay', 'spring', 'sale', 'margit', 'larger', 'headline', '.png', '.html', 'loop-', '1x1', 'runs/', 'my ads', user.toLowerCase(), os.hostname().toLowerCase(), 'http'])
    assert.ok(!sent.toLowerCase().includes(secret), `the report holds "${secret}"`)
  // the counts file itself holds numbers under fixed names and nothing else
  const leaves = (v) => (v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [v])
  const counts = JSON.parse(fs.readFileSync(path.join(HOME, 'counts.json'), 'utf8'))
  assert.ok(leaves(counts).every((v) => typeof v === 'number'), 'counts.json holds only numbers')
  assert.deepEqual(Object.keys(counts).sort(), ['ads', 'errors', 'formats', 'loopsEqual', 'loopsKept', 'loopsLost', 'runMinutes', 'runs', 'studioExports'])
})

test('at most one report a day', async () => {
  await post('api/statistics', { on: true })
  await settle()
  assert.equal(reports().length, 1)
})

test('turning the switch off deletes the ID and stops the sending; on again makes a new ID', async () => {
  const first = settings().installId
  setSettings((s) => { s.lastReport = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() })
  await post('api/statistics', { on: false })
  await settle()
  assert.equal(settings().statistics, false)
  assert.equal('installId' in settings(), false)
  assert.equal(reports().length, 1, 'a report was due, and none was sent')
  assert.match(await (await fetch(address + 'api/report')).text(), /Statistics are off/)
  await post('api/statistics', { on: true })
  await settle()
  assert.equal(reports().length, 2)
  const [old, fresh] = reports().map((r) => JSON.parse(r.body))
  assert.notEqual(fresh.installId, first)
  // the new ID must not arrive carrying the old ID's totals, or the two could be matched
  assert.equal(old.loopsKept + old.loopsLost + old.loopsEqual, 10)
  for (const k of ['runs', 'ads', 'formats', 'loopsKept', 'loopsLost', 'loopsEqual', 'studioExports']) assert.equal(fresh[k], 0, `${k} starts again from zero under the new ID`)
  assert.deepEqual([fresh.minutesPerRun, fresh.errors], [null, {}])
})

test('a refused report is not sent again unchanged, and "skipped" counts as sent', async () => {
  const due = () => setSettings((s) => { delete s.lastReport })
  const before = reports().length
  answer = 400; due()
  await post('api/statistics', { on: true }); await settle()
  assert.equal(reports().length, before + 1)
  assert.equal('lastReport' in settings(), false, 'a refused report is not marked as sent')
  await post('api/statistics', { on: true }); await settle()
  assert.equal(reports().length, before + 1, 'the same bytes are not sent a second time')
  // the totals change, so the report changes and is tried again; 202 means received and not kept
  answer = 202
  run('status', set)
  fs.writeFileSync(path.join(HOME, 'counts.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(HOME, 'counts.json'), 'utf8')), studioExports: 4 }))
  await post('api/statistics', { on: true }); await settle()
  assert.equal(reports().length, before + 2)
  assert.ok(settings().lastReport, 'an answer of 202 counts as sent')
  answer = 200
})

test('"Turn Off Statistics" on the notice leaves no ID and sends nothing', async () => {
  fs.rmSync(path.join(HOME, 'settings.json'))
  const before = reports().length
  await post('api/notice', { statistics: false })
  await settle()
  assert.deepEqual([settings().statistics, 'installId' in settings(), !!settings().noticeShown], [false, false, true])
  assert.equal(reports().length, before)
})

test('the donation ask: only on a finished run opened for the first time, at three runs, then 7 days, 45 after Already Supported', async () => {
  const DAY = 24 * 60 * 60 * 1000
  const open = async (name) => (await (await post('api/opened', { set: `${name}/harbour-bakery` })).json()).ask
  const ago = (days) => setSettings((s) => { s.support.lastAt = Date.now() - days * DAY })
  assert.equal(await open('2026-11-23-spring-sale'), false, 'an unfinished run never asks')
  addRun(runs, '2026-12-01-one'); addRun(runs, '2026-12-02-two')
  assert.equal(await open('2026-12-01-one'), false, 'two finished runs are too few')
  addRun(runs, '2026-12-03-three')
  assert.equal(await open('2026-12-02-two'), true, 'the third finished run exists and this one is opened for the first time')
  await post('api/support', { action: 'shown' })
  assert.equal(await open('2026-12-02-two'), false, 'the same run never asks twice')
  assert.equal(await open('2026-12-03-three'), false, 'not again within 7 days')
  addRun(runs, '2026-12-04-four'); ago(6.9)
  assert.equal(await open('2026-12-04-four'), false)
  addRun(runs, '2026-12-05-five'); ago(7.1)
  assert.equal(await open('2026-12-05-five'), true, 'again after 7 days')
  await post('api/support', { action: 'shown' })
  await post('api/support', { action: 'supported' })
  addRun(runs, '2026-12-06-six'); ago(44)
  assert.equal(await open('2026-12-06-six'), false, 'after Already Supported, not within 45 days')
  addRun(runs, '2026-12-07-seven'); ago(45.1)
  assert.equal(await open('2026-12-07-seven'), true)
  assert.equal((await post('api/support', { action: 'off' })).status, 400, 'no request turns the ask off')
  assert.ok(settings().openedRuns.every((m) => /^[0-9a-f]{16}$/.test(m)), 'opened runs are kept as hashes, not names')
})

test('with nobody listening, the page and the scripts work the same', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'parival-offline-'))
  const env = { ...process.env, PARIVAL_HOME: home, PARIVAL_API: 'http://127.0.0.1:9' }
  // one loop that a critic scored 5 with no defect is locked, so the run is finished
  const other = fakeRuns({ loops: 1 })
  for (const f of fs.readdirSync(other.set).filter((n) => /^\d+x\d+-/.test(n))) fs.writeFileSync(path.join(other.set, f, 'loop-1', 'critique.json'), JSON.stringify(critique(5)))
  const started = JSON.parse(execFileSync(process.execPath, [path.join(PLUGIN, 'skills', 'local-page', 'scripts', 'page.mjs'), 'start', other.runs, '--no-open', '--port', '5399'], { encoding: 'utf8', env }))
  try {
    await fetch(started.address + 'api/notice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"statistics":true}' })
    assert.equal((await fetch(started.address + 'api/list')).status, 200)
    assert.equal(JSON.parse(execFileSync(process.execPath, [path.join(PLUGIN, 'skills', 'campaign-run', 'scripts', 'run.mjs'), 'status', other.set], { encoding: 'utf8', env })).done, true)
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'counts.json'), 'utf8')).runs, 1, 'the finished run is counted once')
    execFileSync(process.execPath, [path.join(PLUGIN, 'skills', 'campaign-run', 'scripts', 'run.mjs'), 'status', other.set], { env })
    assert.equal(JSON.parse(fs.readFileSync(path.join(home, 'counts.json'), 'utf8')).runs, 1)
    assert.equal('lastReport' in JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')), false, 'a report that did not arrive is not marked as sent')
  } finally { execFileSync(process.execPath, [path.join(PLUGIN, 'skills', 'local-page', 'scripts', 'page.mjs'), 'stop', other.runs], { env }) }
})
