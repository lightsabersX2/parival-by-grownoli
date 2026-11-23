#!/usr/bin/env node
// Bookkeeping for a run: a campaign of several ads, each in five formats, each through at most three loops.
// A set is <runs>/<run>/<company>/, a format is <size>-<ad> (1x1-open-house), a loop is <format>/loop-<n>/ with ad.html,
// ad.png and critique.json. A revision that loses its blind judgement moves to <format>/rejected/loop-<n>/.
//   node run.mjs new <runs folder> <company> <campaign>   makes the set's folder and prints it
//   node run.mjs render <set>          renders every format's newest loop and reports faults
//   node run.mjs critique <set>        stages the newest unjudged renders for blind critics, one folder per ad
//   node run.mjs critique-apply <set>  files the critics' answers as critique.json and prints the defects
//   node run.mjs revise <set> [format…] starts the next loop: copies each open format's ad.html and prints what to fix;
//                                      a named format gets one more loop even after its three
//   node run.mjs judge <set>           stages each revision beside the version before it, unlabelled, sides drawn by lot
//   node run.mjs judge-apply <set>     keeps each revision that won and moves the others to rejected/
//   node run.mjs status <set>          where every format stands and what comes next
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RENDER = path.join(HERE, '..', '..', 'photo-ads', 'scripts', 'render.mjs')
const REFS = path.join(HERE, '..', 'references')
const CASES = path.join(HERE, '..', '..', 'photo-ads', 'references', 'critic-cases.md')
const SIZES = { '1x1': '1080x1080', '3x4': '1080x1440', '9x16': '1080x1920', '16x9': '1920x1080', '4x3': '1440x1080' }
const ORDER = Object.keys(SIZES)
const LOOPS = 3
const LINES = ['message_clear_3s', 'exact_copy', 'hierarchy', 'legibility_phone', 'text_amount', 'photo_colour', 'overlay_craft', 'place', 'brand_fit', 'ambition', 'desire', 'owner_would_pay']

const [cmd, ...args] = process.argv.slice(2)
const fail = (m) => { console.error(m); process.exit(2) }
const slug = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return fallback } }
const writeJson = (f, data) => fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n')
const dirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) } catch { return [] } }
const loopNo = (name) => Number(/^loop-(\d+)$/.exec(name)?.[1])
const print = (o) => console.log(JSON.stringify(o, null, 1))

if (cmd === 'new') {
  const [runs, company, campaign] = args
  if (!runs || !company || !campaign) fail('usage: node run.mjs new <runs folder> <company> <campaign>')
  const set = path.join(path.resolve(runs), `${new Date().toLocaleDateString('sv-SE')}-${slug(campaign)}`, slug(company))
  fs.mkdirSync(path.join(set, 'assets'), { recursive: true })
  // the folder name is plain ASCII; the page shows the campaign's name as it was given
  writeJson(path.join(set, '..', 'run.json'), { title: campaign.trim() })
  print({ set, assets: path.join(set, 'assets'), formats: ORDER.map((s) => `${s}-<ad>`), sizes: SIZES })
  process.exit(0)
}

const set = args[0] && path.resolve(args[0])
if (!set || !fs.existsSync(set)) fail(`usage: node run.mjs ${cmd ?? '<command>'} <set folder>. Commands: new, render, critique, critique-apply, revise, judge, judge-apply, status.`)
const STAGING = path.join(set, '.staging')
const briefs = readJson(path.join(set, 'briefs.json'), [])
const sizeOf = (format) => format.split('-')[0]
const adOf = (format) => format.split('-').slice(1).join('-') || 'ad'
const formats = dirs(set).filter((f) => SIZES[sizeOf(f)] && /^\d+x\d+(-[\w-]+)?$/.test(f))
  .sort((a, b) => adOf(a).localeCompare(adOf(b)) || ORDER.indexOf(sizeOf(a)) - ORDER.indexOf(sizeOf(b)))
const kept = (f) => dirs(path.join(set, f)).map(loopNo).filter(Boolean).sort((a, b) => a - b)
const rejected = (f) => dirs(path.join(set, f, 'rejected')).map(loopNo).filter(Boolean).sort((a, b) => a - b)
const latest = (f) => kept(f).at(-1)
const loopDir = (f, n) => path.join(set, f, `loop-${n}`)
const critiqueOf = (f, n) => readJson(path.join(loopDir(f, n), 'critique.json'), null)
// Locked: the newest critic scored every line 4 or more and named no defect. The ad then stays as it is.
const locked = (f) => { const c = latest(f) && critiqueOf(f, latest(f)); return !!c && !c.defects?.length && Object.values(c.scores ?? {}).length > 0 && Object.values(c.scores).every((v) => v >= 4) }
const used = (f) => kept(f).length + rejected(f).length
const finished = (f) => used(f) >= LOOPS || locked(f)
const judgements = () => readJson(path.join(set, 'judgements.json'), [])
const judged = (f, n) => judgements().some((j) => j.format === f && j.loop === n)
const byAd = (list) => Object.entries(Object.groupBy(list, adOf))
const newest = (kind) => { const n = Math.max(0, ...dirs(STAGING).map((d) => Number(new RegExp(`^${kind}-(\\d+)$`).exec(d)?.[1])).filter(Boolean)); return n ? path.join(STAGING, `${kind}-${n}`) : null }
const stage = (kind) => { const n = Math.max(0, ...dirs(STAGING).map((d) => Number(new RegExp(`^${kind}-(\\d+)$`).exec(d)?.[1])).filter(Boolean)) + 1; const d = path.join(STAGING, `${kind}-${n}`); fs.mkdirSync(d, { recursive: true }); return d }
const briefFor = (ad) => briefs.filter((b) => adOf(b.format ?? '') === ad)
const prompt = (role, file, folder) => `You are an independent ${role} of finished ads. Read ${file} in the folder "${folder}" and do exactly what it says. Read no file outside that folder.`

function render(html, png, size, flags) {
  return new Promise((res) => execFile(process.execPath, [RENDER, html, png, '--size', size, ...flags], { maxBuffer: 1 << 26 }, (err, out, errOut) => {
    try { res(JSON.parse(out)) } catch { res({ problems: [`render failed: ${(errOut || err?.message || 'no output').trim().slice(0, 300)}`] }) }
  }))
}

if (cmd === 'render') {
  if (!formats.length) fail('No format folders yet. A format is <size>-<ad>, such as 1x1-open-house, with loop-1/ad.html inside.')
  const todo = formats.filter((f) => latest(f) && fs.existsSync(path.join(loopDir(f, latest(f)), 'ad.html')))
  const out = {}
  // four at a time: each render starts its own throwaway browser
  for (let i = 0; i < todo.length; i += 4) await Promise.all(todo.slice(i, i + 4).map(async (f) => {
    const dir = loopDir(f, latest(f)), b = briefs.find((x) => x.format === f) ?? {}
    const r = await render(path.join(dir, 'ad.html'), path.join(dir, 'ad.png'), SIZES[sizeOf(f)], [b.older && '--older', b.seal && '--seal'].filter(Boolean))
    out[f] = { loop: latest(f), png: path.join(dir, 'ad.png'), problems: r.problems ?? [] }
  }))
  // the page reads each ad's words from manifest.json, so it is rebuilt from the briefs at every render
  writeJson(path.join(set, 'manifest.json'), briefs.map((b) => ({ format: b.format, company: b.brand, headline: b.headline, subheadline: b.subheadline, cta: b.cta, photo_source_url: b.photo_source_url })))
  const missing = formats.filter((f) => !briefs.some((b) => b.format === f))
  print({ rendered: out, ...(missing.length && { no_brief: missing }), faults: Object.values(out).reduce((n, r) => n + r.problems.length, 0) })
} else if (cmd === 'critique') {
  const todo = formats.filter((f) => latest(f) && fs.existsSync(path.join(loopDir(f, latest(f)), 'ad.png')) && !critiqueOf(f, latest(f)))
  if (!todo.length) fail('Every newest render already has its critique.')
  const dir = stage('critique'), tasks = []
  for (const [ad, list] of byAd(todo)) {
    const folder = path.join(dir, ad)
    fs.mkdirSync(folder, { recursive: true })
    for (const f of list) fs.copyFileSync(path.join(loopDir(f, latest(f)), 'ad.png'), path.join(folder, `${f}.png`))
    writeJson(path.join(folder, 'brief.json'), briefFor(ad).filter((b) => list.includes(b.format)))
    fs.writeFileSync(path.join(folder, 'critic.md'), fs.readFileSync(path.join(REFS, 'critic.md'), 'utf8') + '\n' + fs.readFileSync(CASES, 'utf8'))
    tasks.push({ ad, formats: list, folder, prompt: prompt('critic', 'critic.md', folder) })
  }
  writeJson(path.join(dir, 'key.json'), Object.fromEntries(todo.map((f) => [f, latest(f)])))
  print({ start_one_fresh_subagent_per_task: tasks, then: `node "${fileURLToPath(import.meta.url)}" critique-apply "${set}"` })
} else if (cmd === 'critique-apply') {
  const dir = newest('critique')
  if (!dir) fail('Nothing staged. Run critique first.')
  const key = readJson(path.join(dir, 'key.json'), {}), out = {}, bad = []
  for (const [f, n] of Object.entries(key)) {
    const c = readJson(path.join(dir, adOf(f), `${f}.json`), null)
    const scores = c?.scores && LINES.every((l) => Number.isInteger(c.scores[l]) && c.scores[l] >= 1 && c.scores[l] <= 5)
    if (!c || !scores || !Array.isArray(c.defects)) { bad.push(`${f}: ${c ? 'scores must hold every rubric line as a whole number from 1 to 5, and defects must be a list' : `no ${f}.json in ${path.join(dir, adOf(f))}`}`); continue }
    writeJson(path.join(loopDir(f, n), 'critique.json'), { format: f, ...c })
    out[f] = { loop: n, lowest: Math.min(...Object.values(c.scores)), defects: c.defects, plain_or_template: c.plain_or_template, locked: locked(f) }
  }
  const sets = Object.fromEntries(byAd(Object.keys(key)).map(([ad]) => [ad, readJson(path.join(dir, ad, 'set.json'), null)]).filter(([, v]) => v))
  if (Object.keys(sets).length) writeJson(path.join(set, 'set-critique.json'), { ...readJson(path.join(set, 'set-critique.json'), {}), ...sets })
  print({ filed: out, ...(Object.keys(sets).length && { set: sets }), ...(bad.length && { missing_or_malformed: bad, fix: 'Have the same critic correct its file, then run critique-apply again.' }) })
  if (bad.length) process.exitCode = 1
} else if (cmd === 'revise') {
  // formats named after the set get one more loop whatever they have used: the person asked for a change there
  const named = args.slice(1)
  const unknown = named.filter((f) => !formats.includes(f))
  if (unknown.length) fail(`No such format in this set: ${unknown.join(', ')}. It has ${formats.join(', ')}.`)
  const open = named.length ? named : formats.filter((f) => latest(f) && !finished(f))
  const waiting = named.length ? [] : open.filter((f) => !critiqueOf(f, latest(f)))
  if (waiting.length) fail(`These newest versions have no critique yet, so there is nothing to revise against: ${waiting.join(', ')}. Run critique first.`)
  const out = {}
  for (const f of open) {
    const from = latest(f), n = Math.max(...kept(f), ...rejected(f)) + 1, dir = loopDir(f, n)
    fs.mkdirSync(dir, { recursive: true })
    fs.copyFileSync(path.join(loopDir(f, from), 'ad.html'), path.join(dir, 'ad.html'))
    const lost = judgements().filter((j) => j.format === f && j.winner !== 'revision').map((j) => `loop ${j.loop} lost: ${j.reason}`)
    // a loop the person asked for answers their own words, so no judge decides it
    if (named.length) writeJson(path.join(set, 'judgements.json'), [...judgements(), { format: f, loop: n, previous: from, winner: 'revision', reason: 'the person asked for this change' }])
    out[f] = { edit: path.join(dir, 'ad.html'), made_from: `loop-${from}`, defects: critiqueOf(f, from)?.defects ?? [], plain_or_template: critiqueOf(f, from)?.plain_or_template, ...(lost.length && { earlier_revisions: lost }) }
  }
  const done = formats.filter((f) => !open.includes(f))
  print({ revise: out, ...(done.length && { left_as_they_are: Object.fromEntries(done.map((f) => [f, locked(f) ? 'locked' : 'three loops used'])) }) })
} else if (cmd === 'judge') {
  const todo = formats.filter((f) => kept(f).length > 1 && !judged(f, latest(f)) && fs.existsSync(path.join(loopDir(f, latest(f)), 'ad.png')))
  if (!todo.length) fail('No revision is waiting for a judge.')
  const dir = stage('judge'), key = {}, tasks = []
  for (const [ad, list] of byAd(todo)) {
    const folder = path.join(dir, ad)
    fs.mkdirSync(folder, { recursive: true })
    for (const f of list) {
      const revision = latest(f), previous = kept(f).at(-2), flip = Math.random() < 0.5
      key[f] = { A: flip ? 'revision' : 'previous', revision, previous }
      fs.copyFileSync(path.join(loopDir(f, flip ? revision : previous), 'ad.png'), path.join(folder, `${f}-A.png`))
      fs.copyFileSync(path.join(loopDir(f, flip ? previous : revision), 'ad.png'), path.join(folder, `${f}-B.png`))
    }
    writeJson(path.join(folder, 'brief.json'), briefFor(ad).filter((b) => list.includes(b.format)))
    fs.copyFileSync(path.join(REFS, 'judge.md'), path.join(folder, 'judge.md'))
    tasks.push({ ad, formats: list, folder, prompt: prompt('judge', 'judge.md', folder) })
  }
  // the key sits outside every folder a judge is given
  writeJson(path.join(STAGING, `${path.basename(dir)}.key.json`), key)
  print({ start_one_fresh_subagent_per_task: tasks, then: `node "${fileURLToPath(import.meta.url)}" judge-apply "${set}"` })
} else if (cmd === 'judge-apply') {
  const dir = newest('judge')
  if (!dir) fail('Nothing staged. Run judge first.')
  const key = readJson(path.join(STAGING, `${path.basename(dir)}.key.json`), {}), out = {}, bad = [], log = judgements()
  for (const [f, k] of Object.entries(key)) {
    if (judged(f, k.revision)) continue
    const v = readJson(path.join(dir, adOf(f), 'verdicts.json'), {})[f]
    if (!v || !['A', 'B', 'equal'].includes(v.winner)) { bad.push(`${f}: no verdict of A, B or equal in ${path.join(dir, adOf(f), 'verdicts.json')}`); continue }
    const winner = v.winner === 'equal' ? 'equal' : (v.winner === 'A') === (k.A === 'revision') ? 'revision' : 'previous'
    if (winner !== 'revision') {
      fs.mkdirSync(path.join(set, f, 'rejected'), { recursive: true })
      fs.renameSync(loopDir(f, k.revision), path.join(set, f, 'rejected', `loop-${k.revision}`))
    }
    log.push({ format: f, loop: k.revision, previous: k.previous, winner, reason: v.reason ?? '' })
    out[f] = { winner, kept: `loop-${latest(f)}`, reason: v.reason ?? '' }
  }
  writeJson(path.join(set, 'judgements.json'), log)
  // the page's Smart Pick shows the version in kept.json, which sits beside the company's folder
  writeJson(path.join(set, '..', 'kept.json'), { ...readJson(path.join(set, '..', 'kept.json'), {}), ...Object.fromEntries(formats.map((f) => [f, `loop-${latest(f)}`])) })
  print({ judged: out, ...(bad.length && { missing: bad, fix: 'Have the same judge write its verdict, then run judge-apply again.' }) })
  if (bad.length) process.exitCode = 1
} else if (cmd === 'status') {
  const rows = Object.fromEntries(formats.map((f) => [f, {
    kept: kept(f).map((n) => `loop-${n}`), rejected: rejected(f).map((n) => `loop-${n}`), loops_used: used(f), locked: locked(f),
    rendered: !!latest(f) && fs.existsSync(path.join(loopDir(f, latest(f)), 'ad.png')), critique: !!latest(f) && !!critiqueOf(f, latest(f)),
    awaiting_judge: kept(f).length > 1 && !judged(f, latest(f)),
  }]))
  const v = Object.values(rows)
  const next = !formats.length ? 'build loop-1/ad.html for every format'
    : v.some((r) => !r.rendered) ? 'render'
    : v.some((r) => r.awaiting_judge) ? 'judge, then judge-apply'
    : v.some((r) => !r.critique) ? 'critique, then critique-apply'
    : formats.some((f) => !finished(f)) ? 'revise, edit each ad.html, then render'
    : 'nothing: every format has had its three loops or is locked'
  const ads = byAd(formats).map(([ad, list]) => ({ ad, formats: list.map(sizeOf), missing: ORDER.filter((s) => !list.some((f) => sizeOf(f) === s)) }))
  print({ set, ads, formats: rows, next, done: next.startsWith('nothing') && ads.every((a) => !a.missing.length) })
} else fail('Commands: new, render, critique, critique-apply, revise, judge, judge-apply, status.')
