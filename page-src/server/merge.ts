// Bringing a fresh scan into the page while the person works: new projects and new runs are added, and every object already
// on screen stays the same object, so an open panel, a note being typed or a chosen version is left alone.
import type { AdSet, Project } from './types.ts'

type P = Pick<Project, 'key' | 'name'> & { sets: Pick<AdSet, 'id' | 'date' | 'run'>[] }
const newerSet = (a: { date: string; run: string }, b: { date: string; run: string }) => b.date.localeCompare(a.date) || b.run.localeCompare(a.run)

/** Adds to `shown` what `next` has that it lacks; returns the ids of the runs added. */
export function mergeProjects<T extends P>(shown: T[], next: T[]): string[] {
  const added: string[] = []
  for (const p of next) {
    const here = shown.find((x) => x.key === p.key)
    if (!here) {
      shown.push(p)
      added.push(...p.sets.map((s) => s.id))
      continue
    }
    for (const s of p.sets) if (!here.sets.some((x) => x.id === s.id)) here.sets.push(s), added.push(s.id)
    here.sets.sort(newerSet)
  }
  return added
}

/** A project's latest run date, for sorting the sidebar by recency. */
const latest = (p: P) => p.sets.reduce((d, s) => (s.date > d ? s.date : d), '')
export const recentFirst = (a: P, b: P) => latest(b).localeCompare(latest(a)) || a.name.localeCompare(b.name, 'en')



/** The projects whose name holds the search text, ignoring case and accents: "malmo" finds Malmö Bageri. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
export const matchingProjects = <T extends { name: string }>(ps: T[], query: string) => {
  const q = fold(query.trim())
  return q ? ps.filter((p) => fold(p.name).includes(q)) : ps
}
