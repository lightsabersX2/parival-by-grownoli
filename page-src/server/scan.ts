// Reads <runs>/<run>/<company>/ into projects. Two layouts: flat (<format>.png) and rounds (<format>/loop-<n>/ad.png).
// A company is one project across runs, its folder name folded (case, spaces, underscores).
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { criticSummary } from './critic.ts'
import { setStatus } from './status.ts'
import type { Ad, AdSet, AdText, Critique, Feedback, Project } from './types.ts'

// a size, optionally followed by a slot name, so one set can hold many ads of one size: 1x1, 1x1-a01
const FORMAT = /^\d+x\d+(-[\w-]+)?$/
const LOOP = /^loop-(\d+)$/

export const projectKey = (company: string) => company.trim().toLowerCase().replace(/[\s_]+/g, '-')
const titleCase = (key: string) => key.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

async function entries(dir: string) {
  try {
    return await readdir(dir, { withFileTypes: true })
  } catch {
    return []
  }
}
const mtime = async (p: string) => { try { return (await stat(p)).mtimeMs } catch { return 0 } }
async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return undefined
  }
}

// the campaign's name, from what follows the date in the run's folder name: 2026-11-23-spring-sale reads "Spring sale"
const campaign = (run: string) => { const w = run.replace(/^\d{4}-\d{2}-\d{2}-?/, '').replace(/-/g, ' ').trim(); return w && w.charAt(0).toUpperCase() + w.slice(1) }

/** The kept loop for `format` from the run's kept.json, whose keys are the format or its label after the ratio. */
export function keptRound(kept: Record<string, string>, format: string, rounds: { n: number }[]) {
  const loop = kept[format] ?? kept[format.replace(/^\d+x\d+-/, '')]
  const n = Number(LOOP.exec(loop ?? '')?.[1])
  return rounds.some((r) => r.n === n) ? n : undefined
}

async function scanSet(outDir: string, run: string, company: string): Promise<{ set: AdSet; name?: string } | null> {
  const rel = `${run}/${company}`
  const dir = join(outDir, run, company)
  const items = await entries(dir)
  const names = new Set(items.map((e) => e.name))
  const keptMap = (await readJson<Record<string, string>>(join(outDir, run, 'kept.json'))) ?? {}
  // the campaign's name with its own letters, written beside the company's folder when the run was made
  const title = (await readJson<{ title?: string }>(join(outDir, run, 'run.json')))?.title?.trim()
  const manifest = (await readJson<(AdText & { format?: string; company?: string })[]>(join(dir, 'manifest.json'))) ?? []
  const ads: Ad[] = []
  let lastChange = 0
  const formats = new Set<string>()
  for (const e of items) {
    const f = e.name.replace(/\.png$/, '')
    if (FORMAT.test(f)) formats.add(f)
  }
  for (const format of [...formats].sort(byFormat)) {
    let rounds: Ad['rounds'] = []
    let rejected = 0
    const lost: Ad['rounds'] = []
    if (names.has(`${format}.png`)) rounds = [{ n: 1, image: `${rel}/${format}.png` }]
    else {
      for (const l of await entries(join(dir, format))) {
        const m = LOOP.exec(l.name)
        if (!m || !l.isDirectory()) continue
        const loopDir = join(dir, format, l.name)
        lastChange = Math.max(lastChange, await mtime(loopDir))
        const files = new Set((await entries(loopDir)).map((x) => x.name))
        for (const f of ['ad.png', 'critique.json']) if (files.has(f)) lastChange = Math.max(lastChange, await mtime(join(loopDir, f)))
        if (!files.has('ad.png')) continue
        const critique = files.has('critique.json') ? await readJson<Critique>(join(loopDir, 'critique.json')) : undefined
        rounds.push({ n: Number(m[1]), image: `${rel}/${format}/${l.name}/ad.png`, ...(critique && { critique }) })
      }
      rounds.sort((a, b) => a.n - b.n)
      for (const l of await entries(join(dir, format, 'rejected'))) {
        const m = LOOP.exec(l.name)
        if (!m || !l.isDirectory()) continue
        rejected++
        if ((await mtime(join(dir, format, 'rejected', l.name, 'ad.png'))) > 0) lost.push({ n: Number(m[1]), image: `${rel}/${format}/rejected/${l.name}/ad.png` })
      }
      lost.sort((a, b) => a.n - b.n)
    }
    if (!rounds.length) continue
    const m = manifest.find((x) => x.format === format)
    const text = m && { headline: m.headline, subheadline: m.subheadline, cta: m.cta, photo_source_url: m.photo_source_url }
    const kept = keptRound(keptMap, format, rounds)
    ads.push({ format, rounds, ...(text && { text }), ...(rejected && { rejected }), ...(lost.length && { lost }), ...(kept && { kept }) })
  }
  // a company a maker has just started on has research or briefs but no ad yet: show it at once, as a run being made
  const started = ['research.md', 'briefs.json', 'brand.md', 'notes'].some((n) => names.has(n))
  if (!ads.length && !started) return null
  if (!ads.length) lastChange = await mtime(dir)
  const feedback = (await readJson<Feedback>(join(dir, 'feedback.json'))) ?? { ads: {} }
  const set: AdSet = {
    id: rel,
    run,
    company,
    date: /\d{4}-\d{2}-\d{2}/.exec(run)?.[0] ?? '',
    ads,
    maxRound: Math.max(0, ...ads.flatMap((a) => a.rounds.map((r) => r.n))),
    critic: criticSummary(ads),
    status: setStatus(ads, lastChange),
    ...(names.has('notes.md') && { notes: `${rel}/notes.md` }),
    ...((title || campaign(run)) && { label: title || campaign(run) }),
    feedback: { ...feedback, ads: feedback.ads ?? {} },
  }
  // the manifest's spelling of the company names the project
  return { set, name: manifest.find((x) => x.company)?.company }
}

// the formats of one ad stay together (the name after the size), in the order the runs write them
const ORDER = ['1x1', '3x4', '4x5', '9x16', '16x9', '4x3']
function byFormat(a: string, b: string) {
  const i = (f: string) => (ORDER.includes(f.split('-')[0]) ? ORDER.indexOf(f.split('-')[0]) : ORDER.length)
  const slot = (f: string) => f.split('-').slice(1).join('-')
  return slot(a).localeCompare(slot(b)) || i(a) - i(b) || a.localeCompare(b)
}

/** Newest set first: by the date in the run's name, then by the run's name. */
export const newerFirst = (a: AdSet, b: AdSet) => b.date.localeCompare(a.date) || b.run.localeCompare(a.run)

export async function scanOut(outDir: string): Promise<Project[]> {
  const byKey = new Map<string, Project>()
  for (const run of await entries(outDir)) {
    if (!run.isDirectory() || run.name.startsWith('.')) continue
    for (const company of await entries(join(outDir, run.name))) {
      if (!company.isDirectory() || company.name.startsWith('.')) continue
      const found = await scanSet(outDir, run.name, company.name)
      if (!found) continue
      const key = projectKey(company.name)
      const p = byKey.get(key) ?? { key, name: titleCase(key), sets: [] }
      if (found.name) p.name = found.name
      p.sets.push(found.set)
      byKey.set(key, p)
    }
  }
  const projects = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'))
  for (const p of projects) p.sets.sort(newerFirst)
  return projects
}
