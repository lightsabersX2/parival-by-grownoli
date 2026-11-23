// Whether a set is finished: every ad has had its three loops, kept or rejected, or is locked.
import type { Ad } from './types.ts'

export type SetStatus = 'done' | 'working' | 'unfinished'
/** A set that changed this recently is taken to be still in the making. */
export const WORKING_MS = 20 * 60_000
const LOOPS = 3

/** Locked: the newest critic scored every line 4 or more and named no defect, so the ad stays as it is. */
export function locked(ad: Ad) {
  const c = ad.rounds[ad.rounds.length - 1]?.critique
  const scores = Object.values(c?.scores ?? {})
  return scores.length > 0 && scores.every((v) => v >= 4) && !c?.defects?.length
}

export function setStatus(ads: Ad[], lastChange: number, now = Date.now()): SetStatus {
  const flat = ads.every((a) => a.rounds.every((r) => !r.image.includes('/loop-')))
  const finished = ads.length > 0 && (flat || ads.every((a) => a.rounds.length + (a.rejected ?? 0) >= LOOPS || locked(a)))
  // a maker may add a fourth loop after the set critic, so a recent change means the set is still being made
  if (now - lastChange < WORKING_MS) return 'working'
  return finished ? 'done' : 'unfinished'
}

/** Sets already on screen whose ads have gained or lost a version since; new sets are counted elsewhere. */
export function changedSets(shown: { sets: { id: string; ads: Ad[] }[] }[], now: { sets: { id: string; ads: Ad[] }[] }[]) {
  const sig = (s: { ads: Ad[] }) => s.ads.map((a) => a.rounds.length).join(',')
  const before = new Map(shown.flatMap((p) => p.sets.map((s) => [s.id, sig(s)] as const)))
  return now.flatMap((p) => p.sets).filter((s) => before.has(s.id) && before.get(s.id) !== sig(s)).map((s) => s.id)
}

type Shown = { key: string; name: string; sets: { id: string; ads: Ad[] }[] }
/** What the update notice names: each project with a new run, then each with new versions of a run on screen. */
export function projectUpdates(shown: Shown[], now: Shown[]) {
  const known = new Set(shown.flatMap((p) => p.sets.map((s) => s.id)))
  const changed = new Set(changedSets(shown, now))
  const runs = now.filter((p) => p.sets.some((s) => !known.has(s.id))).map((p) => ({ key: p.key, name: p.name, kind: 'run' as const }))
  const versions = now.filter((p) => !runs.some((r) => r.key === p.key) && p.sets.some((s) => changed.has(s.id))).map((p) => ({ key: p.key, name: p.name, kind: 'versions' as const }))
  return [...runs, ...versions]
}
