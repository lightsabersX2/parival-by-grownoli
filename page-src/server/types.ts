// The shapes the scanner returns and the page reads. Paths are relative to the out folder.
export type Rating = 'down' | 'up' | 'star' | null
/** What each rating means. The page's tooltips and the campaign-run skill use these words. */
export const RATING_MEANING = {
  star: 'Locked. Agents keep this version as it is.',
  up: 'Good direction. Agents build on this version.',
  down: 'Wrong direction, or you dislike it. Agents move away from it.',
} as const

export interface Critique {
  scores?: Record<string, number>
  evidence?: Record<string, string>
  defects?: string[]
  plain_or_template?: string
  one_change?: string
}
export interface Round { n: number; image: string; critique?: Critique }
export interface AdText { headline?: string; subheadline?: string; cta?: string; photo_source_url?: string }
/** `rejected` counts revisions that lost their blind judgement; they are loops too, though no version is kept. */
export interface Ad { format: string; rounds: Round[]; text?: AdText; rejected?: number; /** the revisions that lost, so every loop can be shown side by side */ lost?: Round[]; /** the version the blind judge kept, from kept.json */ kept?: number }
/** A comment pinned to a spot on the image; x and y run from 0 to 1 across and down. */
export interface Pin { id: string; x: number; y: number; text: string }
export interface VersionFeedback { rating?: Rating; note?: string; pins?: Pin[] }
/** `versions` holds the rating and note per version; `rating`, `note` and `round` are how older files kept them. */
export interface AdFeedback { versions?: Record<string, VersionFeedback>; rating?: Rating; note?: string; round?: number }
export interface Feedback { updated?: string; ads: Record<string, AdFeedback>; set_note?: string; set_rating?: Rating }
export interface AdSet {
  id: string
  run: string
  company: string
  date: string
  ads: Ad[]
  maxRound: number
  critic: { scores: Record<number, number>; best: number | null }
  /** working: changed in the last 20 minutes; done: quiet, and every ad has its three loops; unfinished: quiet without them */
  status: 'done' | 'working' | 'unfinished'
  notes?: string
  /** a plain name for the round when the folder name says little, shown after the date */
  label?: string
  feedback: Feedback
}
export interface Project { key: string; name: string; sets: AdSet[] }
