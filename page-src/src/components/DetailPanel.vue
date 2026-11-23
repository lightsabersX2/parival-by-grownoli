<script setup lang="ts">
// The panel for an ad or a whole set: slides in from the right so the row stays in view. An ad shows its
// big image, its words, the critique of the version shown, the rating and the note to Claude; a set shows its rating,
// its note and the maker's notes. Esc or the close button closes it; ← and → step through the set's ads.
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { AdSet, Rating } from '../../server/types.ts'
import { scoreAverage } from '../../server/critic.ts'
import { BEST, filter, aspect, change, openPin, chosenRound, dateLabel, fileUrl, findSet, noteFocus, otherNotes, panel, ratio, roundOf, scoreLabel, shownFor, stepFormat, versionFeedback, zoom, reveal, loops } from '../state'
import PinLayer from './PinLayer.vue'
import RatingControl from './RatingControl.vue'
import ScoreGrid from './ScoreGrid.vue'

const set = computed(() => (panel.value ? findSet(panel.value.set) : undefined))
const ad = computed(() => set.value?.ads.find((a) => a.format === panel.value?.format))
const round = computed(() => (set.value && ad.value ? shownFor(set.value, ad.value) : undefined))
// the version's own critique; a final render has none, so the critique it answered, of the version before, is shown
const judged = computed(() => (round.value?.critique ? round.value : [...(ad.value?.rounds ?? [])].reverse().find((r) => r.critique && r.n < (round.value?.n ?? 0))))
const critique = computed(() => judged.value?.critique)
const hasCritic = computed(() => !!set.value?.ads.some((a) => a.rounds.some((r) => r.critique?.scores)))
const mine = computed(() => (set.value && ad.value && round.value ? versionFeedback(set.value, ad.value.format, round.value.n) : null))
const others = computed(() => (set.value && ad.value && round.value ? otherNotes(set.value, ad.value.format, round.value.n) : []))
const stored = () => (ad.value ? mine.value?.note : set.value?.feedback.set_note) ?? ''

// the note belongs to the version on screen: a switch of ad or version saves what was typed to the old one first
const note = ref('')
const saved = ref(false)
const failed = ref(false)
let target: { set: AdSet; format?: string; n?: number } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
async function saveNote() {
  clearTimeout(timer)
  timer = undefined
  const t = target
  if (!t) return
  const before = t.format ? versionFeedback(t.set, t.format, t.n!).note ?? '' : t.set.feedback.set_note ?? ''
  if (note.value === before) return
  try {
    await change(t.set, t.format ? { format: t.format, round: t.n, note: note.value } : { setNote: note.value })
    saved.value = true
    failed.value = false
  } catch {
    failed.value = true
  }
}
watch([set, ad, () => round.value?.n], async () => {
  if (timer) await saveNote()
  target = set.value ? { set: set.value, format: ad.value?.format, n: round.value?.n } : null
  note.value = stored()
  saved.value = failed.value = false
}, { immediate: true })
// an undo or redo elsewhere changes the stored note; show it unless the person is typing
watch(stored, (v) => { if (!timer) note.value = v })
function onInput() {
  saved.value = false
  clearTimeout(timer)
  timer = setTimeout(saveNote, 700)
}
const rate = (r: Rating) =>
  set.value && change(set.value, ad.value ? { format: ad.value.format, rating: r, round: round.value?.n } : { setRating: r }).catch(() => {})
const field = ref<HTMLTextAreaElement | null>(null)
watch(noteFocus, async () => { await nextTick(); field.value?.focus() })

const notes = ref<string | null>(null)
watch(() => set.value?.notes, async (rel) => {
  notes.value = null
  if (!rel) return
  const md = await fetch(fileUrl(rel)).then((r) => (r.ok ? r.text() : '')).catch(() => '')
  // the maker's Markdown, cleaned before it reaches the page
  notes.value = DOMPurify.sanitize(await marked.parse(md)).replaceAll('<a ', '<a target="_blank" rel="noreferrer noopener" ')
}, { immediate: true })

function close() {
  void saveNote()
  panel.value = null
}
function step(dir: number) {
  const s = set.value
  if (!s || !ad.value) return
  void saveNote()
  panel.value = { set: s.id, format: stepFormat(s, ad.value.format, dir) }
}
function onKey(e: KeyboardEvent) {
  if (!panel.value || zoom.value || (e.target as HTMLElement).closest('textarea, input, select')) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') step(1)
  else if (e.key === 'ArrowLeft') step(-1)
}
window.addEventListener('keydown', onKey)
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Transition name="panel">
    <aside
      v-if="set"
      class="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line-strong bg-raised shadow-[-24px_0_60px_rgba(0,0,0,0.14)] sm:w-[440px] min-[1500px]:shadow-none"
      :aria-label="ad ? `Ad ${ratio(ad.format)}` : 'Run'"
    >
      <header class="flex items-center gap-2 border-b border-line px-5 py-3">
        <div class="min-w-0 flex-1">
          <h2 class="display truncate text-lg font-semibold">{{ ad ? ratio(ad.format) : dateLabel(set) }}</h2>
          <p v-if="ad" class="truncate text-[12px] text-ink-3">{{ dateLabel(set) }}</p>
        </div>
        <button v-if="ad && round" type="button" class="icon-btn" aria-label="Show image in Finder" title="Show in Finder" @click="reveal([round.image])"><svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3h-4a1 1 0 0 0-1 1.5Z" /></svg></button>
        <template v-if="ad && set.ads.length > 1">
          <button type="button" class="icon-btn" aria-label="Previous Ad" title="Previous Ad" @click="step(-1)">
            <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
          </button>
          <button type="button" class="icon-btn" aria-label="Next Ad" title="Next Ad" @click="step(1)">
            <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
          </button>
        </template>
        <button type="button" class="icon-btn" aria-label="Close" title="Close" @click="close">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>

      <div class="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div v-if="ad && round" class="flex justify-center rounded-sm bg-muted p-3">
          <PinLayer :set="set" :format="ad.format" :n="round.n" :src="fileUrl(round.image)" :alt="ad.text?.headline ?? ''" where="panel" img-class="block max-h-[52vh] max-w-full object-contain" :img-style="{ aspectRatio: aspect(ad.format) }" />
        </div>

        <button v-if="ad && ad.rounds.length + (ad.lost?.length ?? 0) > 1" type="button" class="btn w-full justify-center" title="Every version side by side (C)" @click="loops = { set: set.id, format: ad.format }">Compare Versions</button>
        <div class="flex flex-wrap items-center gap-3">
          <RatingControl :value="ad ? mine?.rating : set.feedback.set_rating" @change="rate" />
          <span v-if="filter === 'liked' && ad" class="ml-auto text-[12px] text-ink-3">Your favourite version, v{{ round?.n }}</span>
          <div v-else-if="set.maxRound > 1" class="ml-auto flex items-center gap-2">
            <span class="text-[12px] text-ink-3">Version</span>
            <div class="seg" role="group" aria-label="Version">
              <button v-for="n in set.maxRound" :key="n" type="button" :aria-pressed="roundOf(set) === n" @click="chosenRound[set.id] = n">{{ n }}</button>
              <button v-if="hasCritic" type="button" :aria-pressed="roundOf(set) === BEST" title="Each ad at the version that won its blind test. Without one, the latest version, unless the critic scored an earlier version at least half a point higher" @click="chosenRound[set.id] = BEST">Smart Pick</button>
            </div>
          </div>
        </div>

        <label class="block">
          <span class="mb-1.5 flex items-baseline gap-2 text-[13px] font-semibold">
            {{ ad && round ? `Note on version ${round.n}` : 'Note on the run' }}
            <span v-if="failed" class="text-[12px] font-normal text-ink-2" role="status">Couldn't save</span>
            <span v-else-if="saved" class="text-[12px] font-normal text-ink-3" role="status">Saved</span>
          </span>
          <textarea
            ref="field"
            v-model="note"
            rows="3"
            class="field block w-full resize-y px-3 py-2 text-[13px]"
            :placeholder="ad ? 'What should change in the next version?' : 'What should change in the next run?'"
            @input="onInput"
            @blur="saveNote"
          ></textarea>
        </label>
        <ul v-if="others.length" class="-mt-3 list-none space-y-1.5 p-0 text-[13px]" aria-label="Notes on other versions">
          <li v-for="o in others" :key="o.n" class="flex gap-2">
            <button type="button" class="shrink-0 font-medium underline underline-offset-2" :title="`Show version ${o.n}`" @click="chosenRound[set.id] = o.n">Version {{ o.n }}</button>
            <span class="min-w-0 text-ink-2">{{ o.note }}</span>
          </li>
        </ul>

        <section v-if="!ad" class="space-y-2">
          <h3 class="label">Scores per version</h3>
          <ScoreGrid :set="set" />
        </section>

        <section v-if="ad && round" class="space-y-2">
          <h3 class="label">Comments on the image</h3>
          <p v-if="!mine?.pins?.length" class="text-[13px] text-ink-2">Click the image to comment on one spot.</p>
          <ol v-else class="list-none space-y-1 p-0 text-[13px]">
            <li v-for="(p, i) in mine.pins" :key="p.id">
              <button type="button" class="flex w-full gap-2.5 rounded-sm px-1.5 py-1 text-left hover:bg-hover" :title="`Edit comment ${i + 1}`" @click="openPin = { id: p.id, where: 'panel' }">
                <span class="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full rounded-bl-none bg-[#ff6d56] px-1 text-[10.5px] font-bold text-white">{{ i + 1 }}</span>
                <span class="min-w-0 flex-1">{{ p.text }}</span>
                <span class="shrink-0 text-[11.5px] whitespace-nowrap text-ink-3 tabular-nums" :title="`${Math.round(p.x * 100)}% from the left, ${Math.round(p.y * 100)}% from the top`">x {{ Math.round(p.x * 100) }}%, y {{ Math.round(p.y * 100) }}%</span>
              </button>
            </li>
          </ol>
        </section>

        <section v-if="ad?.text" class="space-y-2">
          <h3 class="label">Text in the ad</h3>
          <dl class="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1.5 text-[13px]">
            <template v-if="ad.text.headline"><dt class="text-ink-3">Headline</dt><dd>{{ ad.text.headline }}</dd></template>
            <template v-if="ad.text.subheadline"><dt class="text-ink-3">Subheadline</dt><dd>{{ ad.text.subheadline }}</dd></template>
            <template v-if="ad.text.cta"><dt class="text-ink-3">Button</dt><dd>{{ ad.text.cta }}</dd></template>
          </dl>
          <a v-if="ad.text.photo_source_url" :href="ad.text.photo_source_url" target="_blank" rel="noreferrer noopener" class="inline-block text-[13px] text-ink-2 underline underline-offset-2 hover:text-ink">Photo source</a>
        </section>

        <section v-if="critique" class="space-y-3">
          <h3 class="label">Critique of version {{ judged?.n }}</h3>
          <p v-if="judged && round && judged.n !== round.n" class="text-[13px] text-ink-2">Version {{ round.n }} has no critique of its own. It was made from this critique of version {{ judged.n }}.</p>
          <ul v-if="critique.scores" class="list-none space-y-1 p-0 text-[13px]">
            <li v-if="scoreAverage(critique.scores) !== null" class="flex items-baseline gap-3 border-b border-line pb-1.5 font-semibold">
              <span class="flex-1">Average</span>
              <span class="tabular-nums whitespace-nowrap">{{ scoreAverage(critique.scores)?.toFixed(2) }} out of 5</span>
            </li>
            <li v-for="(v, k) in critique.scores" :key="k" class="flex items-baseline gap-3" :title="critique.evidence?.[k]">
              <span class="flex-1">{{ scoreLabel(String(k)) }}</span>
              <span class="tabular-nums whitespace-nowrap text-ink-2">{{ v }} out of 5</span>
            </li>
          </ul>
          <div v-if="critique.defects?.length || critique.one_change" class="space-y-3 rounded-sm bg-muted px-3.5 py-3" lang="en">
            <h4 class="label">Critic's notes</h4>
            <div v-if="critique.defects?.length">
              <p class="mb-1 text-[12.5px] font-semibold">Defects</p>
              <ul class="list-disc space-y-1 pl-5 text-[13px] text-ink-2"><li v-for="d in critique.defects" :key="d">{{ d }}</li></ul>
            </div>
            <div v-if="critique.one_change">
              <p class="mb-1 text-[12.5px] font-semibold">Most important change</p>
              <p class="text-[13px] text-ink-2">{{ critique.one_change }}</p>
            </div>
          </div>
        </section>

        <details v-if="set.notes" class="group border-t border-line pt-4">
          <summary class="cursor-pointer text-[13px] font-semibold select-none">Notes from the run</summary>
          <div class="notes mt-2 text-[12.5px] leading-relaxed text-ink-2" v-html="notes ?? ''"></div>
        </details>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.panel-enter-active, .panel-leave-active { transition: transform 0.28s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease; }
.panel-enter-from, .panel-leave-to { transform: translateX(24px); opacity: 0; }
@media (prefers-reduced-motion: reduce) { .panel-enter-active, .panel-leave-active { transition: none; } }
</style>
