<script setup lang="ts">
// One ad at full size over the page. Two rows answer the arrow keys: the ads of the run, and the ad's versions in the
// strip below. Left and right move along the row in use, down moves to the versions, up back to the ads. Esc or a click
// outside closes it and leaves the ad selected.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Rating } from '../../server/types.ts'
import PinLayer from './PinLayer.vue'
import RatingControl from './RatingControl.vue'
import { change, enlarge, loops, fileUrl, noteFocus, stepFormat, versionFeedback, findSet, panel, ratio, shownFor, zoom } from '../state'

const set = computed(() => (zoom.value ? findSet(zoom.value.set) : undefined))
const index = computed(() => set.value?.ads.findIndex((a) => a.format === zoom.value?.format) ?? -1)
const ad = computed(() => set.value?.ads[index.value])
// a version picked here, in the strip or with up and down; otherwise the one the page shows
const picked = ref<number | null>(null)
watch(() => zoom.value && `${zoom.value.set}/${zoom.value.format}`, () => (picked.value = null))
const round = computed(() => (set.value && ad.value ? ad.value.rounds.find((r) => r.n === picked.value) ?? shownFor(set.value, ad.value) : null))
function stepVersion(by: number) {
  const rs = ad.value?.rounds ?? []
  const i = rs.findIndex((r) => r.n === round.value?.n)
  if (rs.length > 1) picked.value = rs[Math.min(rs.length - 1, Math.max(0, i + by))].n
}
// which row left and right move along; down enters the versions, up returns to the ads
const row = ref<'ads' | 'versions'>('ads')
watch(zoom, (z) => { if (!z) row.value = 'ads' })
// the image fits the space between the header and the strip, measured, so the strip never overlaps it
const stage = ref<HTMLElement | null>(null)
const stageH = ref(0)
let ro: ResizeObserver | undefined
watch(stage, (el) => { ro?.disconnect(); if (el) { ro = new ResizeObserver(([e]) => (stageH.value = e.contentRect.height)); ro.observe(el) } })
const imgStyle = computed(() => ({ maxHeight: `${Math.max(120, stageH.value)}px` }))
const ratingOf = (n: number) => (set.value && ad.value ? versionFeedback(set.value, ad.value.format, n).rating : null)

function step(by: number) {
  if (!set.value || !zoom.value) return
  enlarge(zoom.value.set, stepFormat(set.value, zoom.value.format, by))
}
const mine = computed(() => (set.value && ad.value && round.value ? versionFeedback(set.value, ad.value.format, round.value.n) : null))
const rate = (r: Rating) => set.value && ad.value && change(set.value, { format: ad.value.format, round: round.value!.n, rating: r }).catch(() => {})
function writeNote() {
  zoom.value = null
  noteFocus.value++
}
function details() {
  if (zoom.value) panel.value = { ...zoom.value }
  zoom.value = null
}
function key(e: KeyboardEvent) {
  if (!zoom.value || (e.target as HTMLElement).closest('textarea')) return
  if (e.key === 'Escape') zoom.value = null
  else if (e.key === 'ArrowRight') row.value === 'versions' ? stepVersion(1) : step(1)
  else if (e.key === 'ArrowLeft') row.value === 'versions' ? stepVersion(-1) : step(-1)
  else if (e.key === 'ArrowDown') { if ((ad.value?.rounds.length ?? 0) > 1) row.value = 'versions' }
  else if (e.key === 'ArrowUp') row.value = 'ads'
  else return
  e.preventDefault()
}
onMounted(() => window.addEventListener('keydown', key))
onBeforeUnmount(() => { window.removeEventListener('keydown', key); ro?.disconnect() })
</script>

<template>
  <div v-if="ad && round" class="fixed inset-0 z-50 flex flex-col bg-[#0b0b0e]/95 text-[#f4f4f5]" role="dialog" aria-modal="true" :aria-label="`${ratio(ad.format)} at full size`" @click.self="zoom = null">
    <div class="flex items-center gap-2 px-4 py-3">
      <span class="text-[13px] font-semibold tabular-nums">{{ ratio(ad.format) }}</span>
      <span class="text-[12px] text-[#a1a1aa] tabular-nums">Version {{ round.n }} of {{ ad.rounds.length }}, format {{ index + 1 }} of {{ set!.ads.length }}</span>
      <span class="ml-auto flex items-center gap-2">
        <button v-if="ad.rounds.length + (ad.lost?.length ?? 0) > 1" type="button" class="h-8 rounded-md border border-white/15 px-3 text-[13px] hover:bg-white/10" title="Every version side by side (C)" @click="loops = { ...zoom! }; zoom = null">Compare Versions</button>
        <button type="button" class="h-8 rounded-md border border-white/15 px-3 text-[13px] hover:bg-white/10" @click="details">Details</button>
        <button type="button" class="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/10" aria-label="Close" title="Close (Esc)" @click="zoom = null">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
        </button>
      </span>
    </div>
    <div class="relative flex min-h-0 flex-1 items-center justify-center px-16 py-4" @click.self="zoom = null">
      <div ref="stage" class="pointer-events-none absolute inset-x-0 inset-y-4" aria-hidden="true" />
      <PinLayer :set="set!" :format="ad.format" :n="round.n" :src="fileUrl(round.image)" :alt="ad.text?.headline ?? ''" where="full" img-class="block max-w-full object-contain shadow-2xl" :img-style="imgStyle" />
      <button v-if="set!.ads.length > 1" type="button" class="absolute top-1/2 left-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-opacity hover:bg-white/10" :class="row === 'versions' && 'opacity-40'" aria-label="Previous" title="Previous (left arrow)" @click="step(-1)">
        <svg viewBox="0 0 16 16" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m10 3-5 5 5 5" /></svg>
      </button>
      <button v-if="set!.ads.length > 1" type="button" class="absolute top-1/2 right-2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full transition-opacity hover:bg-white/10" :class="row === 'versions' && 'opacity-40'" aria-label="Next" title="Next (right arrow)" @click="step(1)">
        <svg viewBox="0 0 16 16" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
      </button>
    </div>
    <div v-if="ad.rounds.length > 1" class="mx-auto flex shrink-0 justify-center gap-2 overflow-x-auto rounded-lg px-2 pt-1 pb-1 transition-colors" :class="row === 'versions' ? 'bg-white/10 ring-1 ring-white/25' : ''" role="group" aria-label="Versions" :title="row === 'versions' ? 'Left and right choose a version, up goes back to the ads' : 'Down arrow moves here'">
      <button
        v-for="r in ad.rounds"
        :key="r.n"
        type="button"
        class="flex shrink-0 flex-col items-center gap-1 rounded-md p-1 transition-colors duration-150 hover:bg-white/10"
        :class="r.n === round.n && 'bg-white/10'"
        :aria-pressed="r.n === round.n"
        :title="`Version ${r.n}`"
        @click="picked = r.n; row = 'versions'"
      >
        <img :src="fileUrl(r.image)" alt="" class="h-14 w-auto rounded-sm object-contain outline-2 outline-offset-1" :class="r.n === round.n ? 'outline-solid outline-white' : 'outline-none opacity-60'" loading="lazy" />
        <span class="flex items-center gap-1 text-[11px] tabular-nums" :class="r.n === round.n ? 'text-white' : 'text-[#a1a1aa]'">v{{ r.n }}<svg v-if="ratingOf(r.n) === 'star' || ratingOf(r.n) === 'up'" viewBox="0 0 16 16" class="h-3 w-3" fill="currentColor" stroke="currentColor" stroke-width="1" :aria-label="ratingOf(r.n) === 'star' ? 'Star' : 'Thumbs up'" role="img"><path v-if="ratingOf(r.n) === 'star'" d="M8 1.9l1.8 3.75 4.1.55-3 2.85.75 4.07L8 11.15l-3.65 1.97.75-4.07-3-2.85 4.1-.55Z" /><path v-else d="M6 13.25V7.6l2.6-4.7a1.2 1.2 0 0 1 2.2.85L10.3 6.5h2.4a1.5 1.5 0 0 1 1.47 1.8l-.85 4.3a1.6 1.6 0 0 1-1.57 1.3H6.75a.75.75 0 0 1-.75-.65Z" /></svg></span>
      </button>
    </div>
    <p class="shrink-0 px-4 pt-2 pb-1 text-center text-[12px] text-[#a1a1aa]">Click the image to comment on a detail</p>
    <div class="flex items-center justify-center gap-3 px-4 pt-1 pb-5 [&_button]:text-[#d4d4d8] [&_button:hover]:bg-white/10">
      <RatingControl :value="mine?.rating" @change="rate" />
      <span class="h-5 w-px bg-white/15" aria-hidden="true"></span>
      <button type="button" class="flex h-8 items-center gap-2 rounded-md px-3 text-[13px]" :title="mine?.note ?? ''" @click="writeNote">
        <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 2.75h10v8.5H7l-3 2.5v-2.5H3z" stroke-linejoin="round" :fill="mine?.note ? 'currentColor' : 'none'" /></svg>
        {{ mine?.note ? 'Show Note on Whole Ad' : 'Add Note on Whole Ad' }}
      </button>
    </div>
  </div>
</template>
