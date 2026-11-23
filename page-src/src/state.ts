// The page's shared state: the scanned projects, where the page is (#/p/<project>), the open
// panel and each set's chosen version. Sets that appear while the page is open wait in `pending` until asked for.
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { applyVersion, bestRound, byVersion, favouriteRound, startRound } from '../server/feedback.ts'
import type { Ad, AdSet, Feedback, Pin, Project, Rating, Round, VersionFeedback } from '../server/types.ts'
import { History } from './history.ts'
import { changedSets, projectUpdates } from '../server/status.ts'
import { mergeProjects, recentFirst } from '../server/merge.ts'

export const projects = ref<Project[]>([])
export const pending = shallowRef<Project[] | null>(null)
export const loaded = ref(false)
export const loadFailed = ref(false)

const setIds = (ps: Project[]) => new Set(ps.flatMap((p) => p.sets.map((s) => s.id)))
/** Sets on screen that got a new version since the page loaded, so the Smart Pick may now point elsewhere. */
export const changedSetCount = computed(() => (pending.value ? changedSets(projects.value, pending.value).length : 0))
export const newSetCount = computed(() => {
  if (!pending.value) return 0
  const known = setIds(projects.value)
  return [...setIds(pending.value)].filter((id) => !known.has(id)).length
})

// ---- new runs and projects, marked like unread mail until the person opens them ----
const SEEN_KEY = 'parival.seenRuns'
function readSeen(): Set<string> | null {
  try { const v = localStorage.getItem(SEEN_KEY); return v ? new Set(JSON.parse(v)) : null } catch { return null }
}
export const seenRuns = ref<Set<string>>(new Set())
function saveSeen() { try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seenRuns.value])) } catch { /* kept for this visit only */ } }
export const isNew = (p: Project) => p.sets.some((s) => !seenRuns.value.has(s.id))
export function markSeen(p: Project | null | undefined) {
  if (!p || !isNew(p)) return
  seenRuns.value = new Set([...seenRuns.value, ...p.sets.map((s) => s.id)])
  saveSeen()
}
/** The sidebar's order: newest run first, or by name. */
export const projectSort = ref<'recent' | 'name'>((() => { try { return localStorage.getItem('parival.projectSort') === 'name' ? 'name' : 'recent' } catch { return 'recent' } })())
watch(projectSort, (v) => { try { localStorage.setItem('parival.projectSort', v) } catch { /* not kept */ } })
export const sortedProjects = computed(() => [...projects.value].sort(projectSort.value === 'name' ? (a, b) => a.name.localeCompare(b.name, 'en') : recentFirst))

async function fetchList(): Promise<Project[]> {
  const r = await fetch('/api/list')
  if (!r.ok) throw new Error(String(r.status))
  return r.json()
}
export async function load() {
  try {
    projects.value = await fetchList()
    pending.value = null
    loadFailed.value = false
    // the first visit ever counts everything already there as seen, so only what arrives later is marked New
    const stored = readSeen()
    seenRuns.value = stored ?? new Set(projects.value.flatMap((p) => p.sets.map((s) => s.id)))
    if (!stored) saveSeen()
  } catch {
    loadFailed.value = true
  }
  loaded.value = true
}
/** Looks for new sets, and new versions of sets on screen, without touching what is on screen. */
export async function check() {
  try {
    const next = await fetchList()
    // new projects and runs join the page at once; what is on screen stays the same objects, so nothing open is lost
    mergeProjects(projects.value, next)
    pending.value = changedSets(projects.value, next).length ? next : null
  } catch {
    // the next check tries again
  }
}
/** The projects the update notice names, new runs first. */
export const updates = computed(() => (pending.value ? projectUpdates(projects.value, pending.value) : []))
/** Shows the new list and opens the first project the notice named. */
export async function showPending() {
  const first = updates.value[0]
  await load()
  if (first) go(first.key)
}

// ---- what the page's server knows about this install: the version, the statistics switch, the donation ask ----
export interface AppState { version: string; latest?: string; statistics: boolean; noticeShown: boolean; supported: boolean; supportUrl: string }
export const app = ref<AppState | null>(null)
const post = (path: string, body: unknown) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
export async function loadApp() {
  try { const r = await fetch('/api/state'); if (r.ok) app.value = await r.json() } catch { /* About shows less */ }
}
/** The first-open question was answered: share, or do not share. */
export async function answerNotice(statistics: boolean) {
  if (app.value) app.value = { ...app.value, statistics, noticeShown: true }
  await post('/api/notice', { statistics }).catch(() => {})
}
export async function setStatistics(on: boolean) {
  if (app.value) app.value = { ...app.value, statistics: on, noticeShown: app.value.noticeShown || on }
  await post('/api/statistics', { on }).catch(() => {})
}
/** The donation ask is due and waits for a quiet moment: no panel, no enlarged ad, no comment being written. */
export const supportAsk = ref(false)
const reported = new Set<string>()
/** The person opened an ad of a finished run. The server says whether that run is new to them and the ask is due. */
async function openedRun(setId: string) {
  const set = findSet(setId)
  if (!set?.complete || reported.has(setId)) return
  reported.add(setId)
  try { const r = await post('/api/opened', { set: setId }); if (r.ok && (await r.json()).ask) supportAsk.value = true } catch { /* no ask this time */ }
}
/** The ask was shown, or the person said they have already supported. */
export async function supportAnswer(action: 'shown' | 'supported') {
  if (action === 'supported' && app.value) app.value = { ...app.value, supported: true }
  await post('/api/support', { action }).catch(() => {})
}

// ---- where the page is ----
export const hash = ref(location.hash)
window.addEventListener('hashchange', () => (hash.value = location.hash))
export const route = computed(() => {
  const m = /^#\/p\/([^/]+)/.exec(hash.value)
  return { project: m ? decodeURIComponent(m[1]) : null }
})
// sets the route itself as well, so the page never waits on a hashchange event that may not come
export const go = (key: string) => {
  if (key !== route.value.project) window.scrollTo({ top: 0 })
  location.hash = `#/p/${encodeURIComponent(key)}`
  hash.value = location.hash
}
export const currentProject = computed(() => projects.value.find((p) => p.key === route.value.project) ?? sortedProjects.value[0] ?? null)
/** The project a set belongs to. */
export const projectOf = (setId: string) => projects.value.find((p) => p.sets.some((s) => s.id === setId))
// a project on screen is read, including a run that arrives while it is open
watch(() => [currentProject.value?.key, currentProject.value?.sets.length], () => markSeen(currentProject.value))

// ---- versions and the panel ----
/** The version chosen per set; 0 means each ad at the version the critic scored highest, which sets open on. */
export const chosenRound = reactive<Record<string, number>>({})
export const BEST = 0
export const roundOf = (set: AdSet) => chosenRound[set.id] ?? startRound(set)
/** The round shown for an ad: its best one, or the set's chosen version, or the nearest earlier one this ad has. */
export function shownRound(ad: Ad, n: number): Round {
  if (n === BEST) n = bestRound(ad)
  return [...ad.rounds].reverse().find((r) => r.n <= n) ?? ad.rounds[0]
}
/** The person's rating and note on one version of an ad. */
export const versionFeedback = (set: AdSet, format: string, n: number): VersionFeedback => byVersion(set.feedback.ads[format], set.maxRound)[n] ?? {}
/** Versions of the ad, other than `n`, that carry a note. */
export const otherNotes = (set: AdSet, format: string, n: number) =>
  Object.entries(byVersion(set.feedback.ads[format], set.maxRound)).filter(([k, v]) => Number(k) !== n && v.note).map(([k, v]) => ({ n: Number(k), note: v.note! }))
export const panel = ref<{ set: string; format?: string } | null>(null)
/** The pin comment being written or edited, and in which view: the panel or the full view. */
export const openPin = ref<{ id: string; where: 'panel' | 'full'; at?: { x: number; y: number } } | null>(null)
/** Bumped to put the cursor in the panel's note field. */
export const noteFocus = ref(0)
/** The ad shown full size over the page, or null. */
export const zoom = ref<{ set: string; format: string } | null>(null)
/** The ad whose loops are shown side by side over the page, or null. */
export const loops = ref<{ set: string; format: string } | null>(null)
/** One click on an ad: select it, which opens the side panel. */
export const select = (set: string, format: string) => { panel.value = { set, format }; zoom.value = null; void openedRun(set) }
/** The magnifying glass: select the ad and show it big. */
export const enlarge = (set: string, format: string) => { panel.value = { set, format }; zoom.value = { set, format }; void openedRun(set) }
/** The ad `by` steps away in the set, wrapping at the ends. */
export function stepFormat(set: AdSet, format: string, by: number) {
  const n = set.ads.length
  return set.ads[(set.ads.findIndex((a) => a.format === format) + by + n) % n].format
}
export const findSet = (id: string) => projects.value.flatMap((p) => p.sets).find((s) => s.id === id)

// ---- words ----
// a format may carry a slot after its size (1x1-a01); the size is what the eye needs
export const size = (format: string) => format.split('-')[0]
export const ratio = (format: string) => size(format).replace('x', ':')
export const aspect = (format: string) => size(format).replace('x', ' / ')
export function dateLabel(set: AdSet, siblings: AdSet[] = [], short = false) {
  const d = set.date ? new Date(`${set.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: short ? 'short' : 'long', ...(short ? {} : { year: 'numeric' }) }) : set.run
  if (set.label) return `${d}, ${set.label}`
  return siblings.some((s) => s !== set && s.date === set.date) ? `${d} (${set.run})` : d
}
export const fileUrl = (rel: string) => `/api/file?path=${encodeURIComponent(rel)}`
/** The small JPEG of an image, for rows of ads. */
export const thumbUrl = (rel: string) => `${fileUrl(rel)}&small`

// ---- feedback: shown at once, saved, put back if saving fails; each change can be undone ----
export const saveError = ref(false)
type Patch = { format?: string; round?: number; rating?: Rating; note?: string; pins?: Pin[]; setNote?: string; setRating?: Rating }
export async function saveFeedback(set: AdSet, patch: Patch) {
  const before: Feedback = JSON.parse(JSON.stringify(set.feedback))
  const fb = set.feedback
  if (patch.format) fb.ads[patch.format] = applyVersion(fb.ads[patch.format], set.maxRound, patch.round ?? set.maxRound, patch)
  if (patch.setNote !== undefined) fb.set_note = patch.setNote
  if (patch.setRating !== undefined) fb.set_rating = patch.setRating
  try {
    const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set: set.id, latest: set.maxRound, ...patch }) })
    if (!r.ok) throw new Error(String(r.status))
    saveError.value = false
  } catch {
    set.feedback = before
    saveError.value = true
    throw new Error('not saved')
  }
}

type Change = { set: string; patch: Patch }
const history = new History<Change>()
/** What the last undo or redo did, shown briefly at the bottom of the page. */
export const lastAction = ref<{ text: string; at: number } | null>(null)
const RATING = { down: 'Thumbs down', up: 'Thumbs up', star: 'Star' } as const
/** A change the person made: saved, and kept so ⌘Z can put it back. */
export async function change(set: AdSet, patch: Patch) {
  const v = patch.format ? versionFeedback(set, patch.format, patch.round ?? set.maxRound) : null
  const undo: Patch = v
    ? { format: patch.format, round: patch.round, ...(patch.rating !== undefined && { rating: v.rating ?? null }), ...(patch.note !== undefined && { note: v.note ?? '' }), ...(patch.pins !== undefined && { pins: v.pins ?? [] }) }
    : { ...(patch.setNote !== undefined && { setNote: set.feedback.set_note ?? '' }), ...(patch.setRating !== undefined && { setRating: set.feedback.set_rating ?? null }) }
  await saveFeedback(set, patch)
  const what = patch.rating !== undefined || patch.setRating !== undefined
    ? (patch.rating ?? patch.setRating ? RATING[(patch.rating ?? patch.setRating)!] : 'Rating removed')
    : patch.pins !== undefined ? 'Comment on the image' : 'Note'
  const where = patch.format ? `${ratio(patch.format)}, version ${patch.round}` : dateLabel(set)
  history.push({ label: `${what} on ${where}`, undo: { set: set.id, patch: undo }, redo: { set: set.id, patch } })
}
async function replay(step: ReturnType<typeof history.undo>, side: 'undo' | 'redo') {
  if (!step) return
  const set = findSet(step[side].set)
  if (!set) return
  await saveFeedback(set, step[side].patch).catch(() => {})
  lastAction.value = { text: `${side === 'undo' ? 'Undid' : 'Redid'}: ${step.label}`, at: Date.now() }
}
export const undo = () => replay(history.undo(), 'undo')
export const redo = () => replay(history.redo(), 'redo')

// ---- faster reviewing ----
export type Filter = 'all' | 'unrated' | 'liked'
export const filter = ref<Filter>('all')
/** The version shown for an ad: under My Favourites the one the person rated highest, otherwise the set's chosen version. */
export function shownFor(set: AdSet, ad: Ad): Round {
  if (filter.value === 'liked') {
    const n = favouriteRound(set.feedback.ads[ad.format], set.maxRound)
    const r = ad.rounds.find((x) => x.n === n)
    if (r) return r
  }
  return shownRound(ad, roundOf(set))
}
export const matches = (r: Rating | undefined | null, f: Filter) => f === 'all' || (f === 'unrated' ? !r : r === 'up' || r === 'star')

// the critic's criteria, in words for the page
const SCORE: Record<string, string> = {
  message_clear_3s: 'Message clear in three seconds',
  exact_copy: 'Copy matches the brief',
  hierarchy: 'Clear hierarchy',
  legibility_phone: 'Readable on a phone',
  text_amount: 'Not too much text',
  photo_colour: 'Natural photo colour',
  overlay_craft: 'Clean shading behind the words',
  brand_fit: 'Fits the brand',
  place: 'The place is recognisable',
  ambition: 'A designer would show it',
  desire: 'Makes you want it',
  owner_would_pay: 'The owner would pay to run it',
}
export const scoreLabel = (k: string) => SCORE[k] ?? (k.endsWith('would_pay') ? SCORE.owner_would_pay : k.replace(/_/g, ' '))
/** Opens these files or folders (paths inside the runs folder) in Finder. */
export const reveal = (paths: string[]) => void fetch('/api/reveal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paths }) })
/** A brand's runs, as the folders that hold them. */
export const clientFolders = (p: { sets: { id: string }[] }) => [...new Set(p.sets.map((s) => s.id.split('/')[0]))]
