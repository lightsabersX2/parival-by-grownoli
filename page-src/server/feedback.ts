// Feedback per version of an ad, read by the page and written by the server. Older files kept one rating and one note
// per ad with the version last touched (`round`), or none, which then meant the latest version the gallery showed.
import type { Ad, AdFeedback, Pin, Rating, VersionFeedback } from './types.ts'

export function byVersion(fb: AdFeedback | undefined, latest: number): Record<number, VersionFeedback> {
  const out: Record<number, VersionFeedback> = {}
  for (const [k, v] of Object.entries(fb?.versions ?? {})) out[Number(k)] = { ...v }
  if (fb && (fb.rating || fb.note)) {
    const n = fb.round ?? latest
    out[n] = { ...(fb.rating && { rating: fb.rating }), ...(fb.note && { note: fb.note }), ...out[n] }
  }
  return out
}

export function applyVersion(fb: AdFeedback | undefined, latest: number, round: number, patch: { rating?: Rating; note?: string; pins?: Pin[] }): AdFeedback {
  const all = byVersion(fb, latest)
  const v = { ...all[round] }
  if (patch.rating !== undefined) patch.rating ? (v.rating = patch.rating) : delete v.rating
  if (patch.note !== undefined) patch.note ? (v.note = patch.note) : delete v.note
  if (patch.pins !== undefined) patch.pins.length ? (v.pins = patch.pins) : delete v.pins
  all[round] = v
  const versions: Record<string, VersionFeedback> = {}
  for (const [k, x] of Object.entries(all)) if (x.rating || x.note || x.pins?.length) versions[k] = x
  return { versions }
}

/** The version the person rated highest for this ad, a star beating a thumbs up and a tie going to the later one; null when
 * they gave no version a thumbs up or a star. Drives the My Favourites view. */
export function favouriteRound(fb: AdFeedback | undefined, latest: number): number | null {
  const rank = { star: 2, up: 1 } as Record<string, number>
  let best: number | null = null
  let top = 0
  for (const [k, v] of Object.entries(byVersion(fb, latest))) {
    const r = rank[v.rating ?? ''] ?? 0
    if (r && r >= top && (r > top || Number(k) > (best ?? 0))) [top, best] = [r, Number(k)]
  }
  return best
}

const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length
/** A critic average this far above the latest version's is a real preference; less is critic noise. */
export const CLEARLY_BETTER = 0.5
/** The ad's best version: the latest, unless an earlier one scored at least CLEARLY_BETTER higher, the later one
 * winning a tie. A latest version without a critique is the final render and stays the best. */
export function bestRound(ad: Pick<Ad, 'rounds' | 'kept'>): number {
  if (ad.kept) return ad.kept
  const last = ad.rounds[ad.rounds.length - 1]
  const lastScores = Object.values(last.critique?.scores ?? {})
  if (!lastScores.length) return last.n
  let best = last.n
  let top = avg(lastScores) + CLEARLY_BETTER
  for (const r of ad.rounds.slice(0, -1)) {
    const s = Object.values(r.critique?.scores ?? {})
    if (s.length && avg(s) >= top) [top, best] = [avg(s), r.n]
  }
  return best
}

/** The version a set opens on: 0, each ad at its best version, when the critic scored any of them; otherwise the latest. */
export const startRound = (set: { maxRound: number; ads: Pick<Ad, 'rounds'>[] }) =>
  set.ads.some((a) => a.rounds.some((r) => r.critique?.scores)) ? 0 : set.maxRound

/** Per version: each criterion's average over the round's ads, and how many ads got each rating. Column 0 is each ad
 * at its own best version. */
export function criteriaTable(set: { maxRound: number; ads: Pick<Ad, 'format' | 'rounds'>[]; feedback: { ads: Record<string, AdFeedback> } }) {
  const sums: Record<string, Record<number, number[]>> = {}
  const every: Record<number, number[]> = {}
  const add = (n: number, r: Ad['rounds'][number]) => {
    for (const [k, v] of Object.entries(r.critique?.scores ?? {})) {
      ((sums[k] ??= {})[n] ??= []).push(v)
      ;(every[n] ??= []).push(v)
    }
  }
  for (const ad of set.ads) {
    for (const r of ad.rounds) add(r.n, r)
    add(0, ad.rounds.find((r) => r.n === bestRound(ad))!)
  }
  const criteria: Record<string, Record<number, number>> = {}
  for (const [k, per] of Object.entries(sums)) for (const [n, xs] of Object.entries(per)) (criteria[k] ??= {})[Number(n)] = Math.round(avg(xs) * 10) / 10
  const ratings: Record<number, { down: number; up: number; star: number }> = {}
  for (const ad of set.ads) {
    const all = byVersion(set.feedback.ads[ad.format], set.maxRound)
    for (const [n, v] of Object.entries(all)) if (v.rating) (ratings[Number(n)] ??= { down: 0, up: 0, star: 0 })[v.rating]++
    const b = all[bestRound(ad)]?.rating
    if (b) (ratings[0] ??= { down: 0, up: 0, star: 0 })[b]++
  }
  const overall: Record<number, number> = {}
  for (const [n, xs] of Object.entries(every)) overall[Number(n)] = Math.round(avg(xs) * 10) / 10
  return { criteria, ratings, overall }
}

/** The version columns Scores per Version shows: the three latest, so the table stays one width. */
export const shownVersions = (maxRound: number, keep = 3) =>
  Array.from({ length: Math.min(maxRound, keep) }, (_, i) => maxRound - Math.min(maxRound, keep) + i + 1)
