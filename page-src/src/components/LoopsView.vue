<script setup lang="ts">
// Every loop of one ad side by side, oldest first: the versions that were kept and the revisions that lost their blind
// judgement. Each kept version can be rated here; a click on one opens it large. Esc or a click outside closes it.
import { computed, onBeforeUnmount, onMounted } from 'vue'
import type { Rating } from '../../server/types.ts'
import { scoreAverage } from '../../server/critic.ts'
import { bestRound } from '../../server/feedback.ts'
import { aspect, change, chosenRound, enlarge, fileUrl, findSet, loops, ratio, thumbUrl, versionFeedback } from '../state'
import RatingControl from './RatingControl.vue'

const set = computed(() => (loops.value ? findSet(loops.value.set) : undefined))
const ad = computed(() => set.value?.ads.find((a) => a.format === loops.value?.format))
const all = computed(() => [...(ad.value?.rounds ?? []).map((r) => ({ ...r, lost: false })), ...(ad.value?.lost ?? []).map((r) => ({ ...r, lost: true }))].sort((a, b) => a.n - b.n))
const pick = computed(() => (ad.value ? bestRound(ad.value) : 0))
const ratingOf = (n: number) => (set.value && ad.value ? versionFeedback(set.value, ad.value.format, n).rating : null)
const rate = (n: number, r: Rating) => set.value && ad.value && change(set.value, { format: ad.value.format, round: n, rating: r }).catch(() => {})
function open(n: number) {
  if (!set.value || !ad.value) return
  chosenRound[set.value.id] = n
  enlarge(set.value.id, ad.value.format)
  loops.value = null
}
function key(e: KeyboardEvent) {
  if (loops.value && e.key === 'Escape') { loops.value = null; e.stopImmediatePropagation() }
}
onMounted(() => window.addEventListener('keydown', key, true))
onBeforeUnmount(() => window.removeEventListener('keydown', key, true))
</script>

<template>
  <div v-if="set && ad" class="fixed inset-0 z-[55] flex flex-col bg-[#0b0b0e]/95 text-[#f4f4f5]" role="dialog" aria-modal="true" :aria-label="`Versions of ${ratio(ad.format)}`" @click.self="loops = null">
    <div class="flex items-center gap-3 px-4 py-3">
      <h2 class="text-[13px] font-semibold">Versions of {{ ratio(ad.format) }}</h2>
      <span class="min-w-0 truncate text-[12px] text-[#a1a1aa]">{{ ad.text?.headline }}</span>
      <button type="button" class="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-white/10" aria-label="Close" title="Close (Esc)" @click="loops = null">
        <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
      </button>
    </div>
    <div class="flex min-h-0 flex-1 items-center gap-5 overflow-x-auto px-6 pb-6 max-sm:flex-col max-sm:items-stretch max-sm:overflow-y-auto" @click.self="loops = null">
      <figure v-for="r in all" :key="`${r.n}${r.lost}`" class="flex max-h-full min-w-0 flex-1 flex-col items-center gap-2 max-sm:flex-none" :style="{ minWidth: '180px' }">
        <button v-if="!r.lost" type="button" class="min-h-0 rounded-sm outline-offset-2 hover:outline-2 hover:outline-white/60 hover:outline-solid" :title="`Enlarge version ${r.n}`" :aria-label="`Enlarge version ${r.n}`" @click="open(r.n)">
          <img :src="fileUrl(r.image)" alt="" class="block max-h-[calc(100vh-190px)] max-w-full object-contain shadow-2xl" :style="{ aspectRatio: aspect(ad.format) }" />
        </button>
        <img v-else :src="thumbUrl(r.image)" alt="" class="block max-h-[calc(100vh-190px)] min-h-0 max-w-full object-contain brightness-[0.65]" :style="{ aspectRatio: aspect(ad.format) }" />
        <figcaption class="flex min-h-14 flex-col items-center gap-0.5 text-center text-[12px] [&_button]:text-[#d4d4d8] [&_button:hover]:bg-white/10">
          <span class="font-semibold tabular-nums">Version {{ r.n }}<span v-if="!r.lost && r.n === pick && all.length > 1" class="ml-2 rounded-sm bg-white/15 px-1.5 py-0.5 text-[10.5px] font-semibold">Smart Pick</span></span>
          <span v-if="r.lost" class="text-[#a1a1aa]">Lost its blind comparison with the version before</span>
          <template v-else>
            <span v-if="scoreAverage(r.critique?.scores) !== null" class="text-[#a1a1aa] tabular-nums">Critic's average {{ scoreAverage(r.critique?.scores)?.toFixed(1) }} out of 5</span>
            <RatingControl :value="ratingOf(r.n)" @change="rate(r.n, $event)" />
          </template>
        </figcaption>
      </figure>
    </div>
  </div>
</template>
