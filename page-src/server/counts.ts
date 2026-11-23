// Statistics kept on this computer, and the one report built from them. Two files live in Parival's folder
// (~/.config/parival-by-grownoli, or PARIVAL_HOME): counts.json holds totals and nothing else, and settings.json holds
// the switch, the random ID and when things last happened. No website, brand, word of copy, file name or comment is
// ever written to either file, so the report cannot hold one. Bundled as skills/local-page/scripts/counts.mjs for the
// run and export scripts, and into page.mjs for the page's server.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir, platform, release } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Where the report and the version check go. The one place these addresses are written. */
export const API = process.env.PARIVAL_API ?? 'https://api.grownoli.com'
/** Where a contribution goes. The one place this address is written. */
export const SUPPORT_URL = 'https://buymeacoffee.com/lightsabersx2'

/** The errors that are counted, by code. An error's own text is never kept. */
export const ERROR_CODES = ['render_failed', 'export_failed', 'critique_malformed', 'verdict_missing'] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export interface Counts {
  runs: number; ads: number; formats: number
  loopsKept: number; loopsLost: number; loopsEqual: number
  studioExports: number
  /** minutes each finished run took, newest last, at most 200 */
  runMinutes: number[]
  errors: Partial<Record<ErrorCode, number>>
}
export interface Settings {
  /** on unless the person turned it off */
  statistics: boolean
  /** made when the person has seen the notice and statistics are on; deleted when they are turned off */
  installId?: string
  /** when the person answered the first-open notice; nothing is sent before */
  noticeShown?: string
  lastReport?: string
  /** a short hash of the last report Grownoli refused as malformed, so the same bytes are not sent again */
  refused?: string
  latestVersion?: string
  /** the donation ask: how many times shown, when last, and whether the person said they have supported */
  support: { asks: number; lastAt: number; supported: boolean }
  /** finished runs the person has opened, as short hashes, so each is counted as opened once */
  openedRuns: string[]
}

export const home = () => process.env.PARIVAL_HOME ?? join(homedir(), '.config', 'parival-by-grownoli')
const read = <T>(name: string): Partial<T> => { try { return JSON.parse(readFileSync(join(home(), name), 'utf8')) } catch { return {} } }
function write(name: string, data: unknown) {
  mkdirSync(home(), { recursive: true })
  const tmp = join(home(), `${name}.${process.pid}.tmp`)
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n')
  renameSync(tmp, join(home(), name))
}
const whole = (v: unknown) => (Number.isFinite(v) && (v as number) > 0 ? Math.floor(v as number) : 0)

export function readCounts(): Counts {
  const c = read<Counts>('counts.json')
  const errors: Counts['errors'] = {}
  for (const code of ERROR_CODES) if (whole(c.errors?.[code])) errors[code] = whole(c.errors?.[code])
  return {
    runs: whole(c.runs), ads: whole(c.ads), formats: whole(c.formats), loopsKept: whole(c.loopsKept), loopsLost: whole(c.loopsLost), loopsEqual: whole(c.loopsEqual),
    studioExports: whole(c.studioExports), runMinutes: (Array.isArray(c.runMinutes) ? c.runMinutes : []).map(whole).slice(-200), errors,
  }
}
type Add = Partial<Pick<Counts, 'runs' | 'ads' | 'formats' | 'loopsKept' | 'loopsLost' | 'loopsEqual' | 'studioExports'>> & { error?: ErrorCode; runMinutes?: number }
/** Adds to the totals. Counting never stops the work it counts: a folder that cannot be written is ignored. */
export function count(add: Add) {
  try {
    const c = readCounts()
    for (const k of ['runs', 'ads', 'formats', 'loopsKept', 'loopsLost', 'loopsEqual', 'studioExports'] as const) c[k] += whole(add[k])
    if (add.error && ERROR_CODES.includes(add.error)) c.errors[add.error] = (c.errors[add.error] ?? 0) + 1
    if (add.runMinutes !== undefined) c.runMinutes = [...c.runMinutes, whole(add.runMinutes)].slice(-200)
    write('counts.json', c)
  } catch { /* not counted */ }
}

export function readSettings(): Settings {
  const s = read<Settings>('settings.json')
  return {
    statistics: s.statistics !== false,
    ...(typeof s.installId === 'string' && { installId: s.installId }), ...(s.noticeShown && { noticeShown: s.noticeShown }),
    ...(s.lastReport && { lastReport: s.lastReport }), ...(typeof s.refused === 'string' && { refused: s.refused }), ...(s.latestVersion && { latestVersion: s.latestVersion }),
    support: { asks: whole(s.support?.asks), lastAt: whole(s.support?.lastAt), supported: s.support?.supported === true },
    openedRuns: Array.isArray(s.openedRuns) ? s.openedRuns.map(String).slice(-500) : [],
  }
}
export function saveSettings(change: (s: Settings) => void): Settings {
  const s = readSettings()
  change(s)
  try { write('settings.json', s) } catch { /* kept for this visit only */ }
  return s
}
/** The switch. Off deletes the random ID on this computer; on again makes a new one once the notice has been seen. */
export function setStatistics(on: boolean): Settings {
  return saveSettings((s) => {
    s.statistics = on
    if (!on) delete s.installId
    else if (s.noticeShown && !s.installId) s.installId = randomUUID()
  })
}
/** The person answered the first-open notice, with statistics left on or turned off. */
export function answerNotice(statistics: boolean, now = new Date()): Settings {
  return saveSettings((s) => {
    s.noticeShown ??= now.toISOString()
    s.statistics = statistics
    if (!statistics) delete s.installId
    else s.installId ??= randomUUID()
  })
}

const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2) }
export interface Report {
  installId: string; pluginVersion: string; os: string; node: number
  runs: number; ads: number; formats: number; loopsKept: number; loopsLost: number; loopsEqual: number
  studioExports: number; minutesPerRun: number | null; errors: Partial<Record<ErrorCode, number>>
}
/** The operating system and its version in the few characters Grownoli accepts, such as "macOS 15.6". */
let os: string | undefined
export function osName() {
  if (os) return os
  let name = `${platform()} ${release()}`
  if (platform() === 'darwin') try { name = `macOS ${execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8', timeout: 3000 }).trim()}` } catch { /* the kernel's version says enough */ }
  else if (platform() === 'win32') name = `Windows ${release()}`
  else if (platform() === 'linux') name = `Linux ${release()}`
  return (os = name.replace(/[^A-Za-z0-9 ._-]/g, '').slice(0, 40) || 'unknown')
}

/** The next report, or null when none will be sent: statistics are off, or the notice has not been answered. */
export function report(version: string): Report | null {
  const s = readSettings()
  if (!s.statistics || !s.noticeShown || !s.installId) return null
  const c = readCounts()
  return {
    installId: s.installId, pluginVersion: version, os: osName(), node: Number(process.versions.node.split('.')[0]),
    runs: c.runs, ads: c.ads, formats: c.formats, loopsKept: c.loopsKept, loopsLost: c.loopsLost, loopsEqual: c.loopsEqual,
    studioExports: c.studioExports, minutesPerRun: median(c.runMinutes), errors: c.errors,
  }
}
/** The exact bytes of a report, as they are sent and as Statistics Report shows them. */
export const reportBytes = (r: Report) => JSON.stringify(r, null, 2)

const DAY = 24 * 60 * 60 * 1000
export const SUPPORT_AFTER_RUNS = 3
export const SUPPORT_INTERVAL_DAYS = 7
export const SUPPORTER_INTERVAL_DAYS = 45
/** Whether the donation ask is due, with this many finished runs. */
export function supportDue(state: Settings['support'], finishedRuns: number, now: number) {
  if (state.supported) return now - state.lastAt >= SUPPORTER_INTERVAL_DAYS * DAY
  if (state.asks === 0) return finishedRuns >= SUPPORT_AFTER_RUNS
  return now - state.lastAt >= SUPPORT_INTERVAL_DAYS * DAY
}
/** Whether `a` is a later version than `b`, by its numbers: 0.10.0 is later than 0.9.2. */
export function laterVersion(a: string | undefined, b: string) {
  const [x, y] = [a ?? '', b].map((v) => v.split('.').map((n) => parseInt(n, 10) || 0))
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}
