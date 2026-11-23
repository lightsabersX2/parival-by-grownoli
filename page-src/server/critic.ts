// The blind critic's average per version of a set, and the version it scored highest (a tie goes to the later one).
import type { Ad } from './types.ts'

export interface CriticSummary { scores: Record<number, number>; best: number | null }

export function criticSummary(ads: Pick<Ad, 'rounds'>[]): CriticSummary {
  const all: Record<number, number[]> = {}
  for (const ad of ads) for (const r of ad.rounds) for (const v of Object.values(r.critique?.scores ?? {})) {
    if (typeof v === 'number') (all[r.n] ??= []).push(v)
  }
  const scores: Record<number, number> = {}
  let best: number | null = null
  for (const n of Object.keys(all).map(Number).sort((a, b) => a - b)) {
    scores[n] = Math.round((all[n].reduce((s, v) => s + v, 0) / all[n].length) * 100) / 100
    if (best === null || scores[n] >= scores[best]) best = n
  }
  return { scores, best }
}

// One critique's own average, to two decimals; no scores give no average.
export const scoreAverage = (s?: Record<string, number>): number | null => {
  const v = Object.values(s ?? {}).filter((x) => typeof x === 'number')
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null
}
