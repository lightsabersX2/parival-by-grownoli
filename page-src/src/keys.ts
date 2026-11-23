// Keyboard shortcuts for the page, modelled on Lightroom Classic: P and X flag, numbers rate, E and Space enlarge,
// ⌘Z undoes. They act on the selected ad; while typing in a field only ⌘Z inside the field itself counts.
import { BEST, change, chosenRound, currentProject, enlarge, findSet, loops, noteFocus, panel, redo, roundOf, select, shownFor, undo, zoom } from './state'
import type { Rating } from '../server/types.ts'
import { ref } from 'vue'
import { sidebarFolded } from './sidebar'

export const settingsOpen = ref(false)
export const SHORTCUTS: { group: string; keys: [string[], string][] }[] = [
  { group: 'Rating', keys: [[['P'], 'Thumbs up'], [['X'], 'Thumbs down'], [['S'], 'Star'], [['U'], 'Remove rating'], [['1', '2', '3'], 'Thumbs down, thumbs up, star'], [['0'], 'Remove rating']] },
  { group: 'View', keys: [[['←', '→'], 'Previous and next ad'], [['E'], 'Enlarge the ad, or go back'], [['Space'], 'Enlarge the ad, or go back'], [['[', ']'], 'Previous and next version'], [['B'], 'Smart Pick of versions'], [['C'], 'Compare every version side by side'], [['↓'], 'In full view, move to the versions'], [['↑'], 'In full view, move back to the ads'], [['Esc'], 'Close']] },
  { group: 'Notes', keys: [[['Return'], 'Write a note on the ad']] },
  { group: 'Changes', keys: [[['⌘', 'Z'], 'Undo'], [['⇧', '⌘', 'Z'], 'Redo']] },
  { group: 'Help', keys: [[['⌘', '/'], 'Show keyboard shortcuts'], [['⌘', ','], 'Settings'], [['⌘', 'B'], 'Hide or show the sidebar']] },
]
const RATE: Record<string, Rating> = { p: 'up', x: 'down', s: 'star', u: null, '1': 'down', '2': 'up', '3': 'star', '0': null }

export function onKey(e: KeyboardEvent) {
  const typing = !!(e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable]')
  const mod = e.metaKey || e.ctrlKey
  const k = e.key.toLowerCase()
  if (settingsOpen.value && e.key === 'Escape') { e.stopImmediatePropagation(); return stop(e, () => (settingsOpen.value = false)) }
  if (settingsOpen.value && e.key !== 'Tab') e.stopImmediatePropagation()
  if (mod && (k === '/' || k === ',')) return stop(e, () => (settingsOpen.value = !settingsOpen.value))
  if (mod && k === 'b') return stop(e, () => (sidebarFolded.value = !sidebarFolded.value))
  if (mod && k === 'z' && !typing) return stop(e, () => void (e.shiftKey ? redo() : undo()))
  if (typing || mod || e.altKey || settingsOpen.value) return
  if (e.key === '?') return stop(e, () => (settingsOpen.value = true))
  const set = panel.value ? findSet(panel.value.set) : undefined
  const ad = set?.ads.find((a) => a.format === panel.value?.format)
  if (!set || !ad) {
    const first = currentProject.value?.sets[0]
    if (first?.ads[0] && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) stop(e, () => select(first.id, first.ads[0].format))
    return
  }
  const n = shownFor(set, ad).n
  if (k in RATE) return stop(e, () => void change(set, { format: ad.format, round: n, rating: RATE[k] }).catch(() => {}))
  if (k === 'e' || e.key === ' ') return stop(e, () => (zoom.value ? (zoom.value = null) : enlarge(set.id, ad.format)))
  if (k === 'c') return stop(e, () => { zoom.value = null; loops.value = loops.value ? null : { set: set.id, format: ad.format } })
  if (e.key === 'Enter') return stop(e, () => { zoom.value = null; noteFocus.value++ })
  if (k === 'b') return stop(e, () => (chosenRound[set.id] = roundOf(set) === BEST ? set.maxRound : BEST))
  if (e.key === '[' || e.key === ']') {
    const cur = roundOf(set) === BEST ? n : roundOf(set)
    return stop(e, () => (chosenRound[set.id] = Math.min(set.maxRound, Math.max(1, cur + (e.key === ']' ? 1 : -1)))))
  }
}
function stop(e: KeyboardEvent, run: () => unknown) {
  e.preventDefault()
  run()
}
