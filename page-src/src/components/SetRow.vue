<script setup lang="ts">
// One set (one round of ads for the project): its date, the version switch, the set's rating and "…", then every
// ad side by side at its true shape. Widths follow the shapes, so all ads in the row are the same height.
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ad, AdSet, Project } from '../../server/types.ts'
import { openMenu, type MenuItem } from '../menu'
import { reveal, BEST, aspect, change, enlarge, filter, matches, select, versionFeedback, size, chosenRound, dateLabel, fileUrl, thumbUrl, panel, ratio, roundOf, noteFocus, shownFor } from '../state'
import RatingControl from './RatingControl.vue'
import ScoreTable from './ScoreTable.vue'

const props = defineProps<{ set: AdSet; project: Project }>()
const round = computed(() => roundOf(props.set))
const shown = (ad: Ad) => shownFor(props.set, ad)
const fbOf = (ad: Ad) => versionFeedback(props.set, ad.format, shown(ad).n)
const ads = computed(() => props.set.ads.filter((a) => matches(fbOf(a).rating, filter.value)))
// one row per ad: the formats that share the name after the size
const slot = (f: string) => f.split('-').slice(1).join('-')
const rows = computed(() => { const m = new Map<string, Ad[]>(); for (const a of ads.value) m.set(slot(a.format), [...(m.get(slot(a.format)) ?? []), a]); return [...m.entries()] })
const rowName = (s: string, list: Ad[]) => list.find((a) => a.text?.headline)?.text?.headline ?? (s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' '))
const title = computed(() => dateLabel(props.set, props.project.sets))
const hasCritic = computed(() => props.set.ads.some((a) => a.rounds.some((r) => r.critique?.scores)))
const shape = (f: string) => { const [w, h] = size(f).split('x').map(Number); return w / h }
const isOpen = (ad?: Ad) => panel.value?.set === props.set.id && panel.value.format === ad?.format

function setMenu(): MenuItem[] {
  const items: MenuItem[] = [{ label: 'Show Details', action: () => (panel.value = { set: props.set.id }) }]
  return [...items, { separator: true }, { label: 'Show in Finder', action: () => reveal([props.set.id]) }]
}
function adMenu(ad: Ad): MenuItem[] {
  const img = shown(ad).image
  return [
    { label: 'Show Details', action: () => (panel.value = { set: props.set.id, format: ad.format }) },
    { label: 'Open Image in New Tab', action: () => window.open(fileUrl(img), '_blank', 'noopener') },
    { separator: true },
    { label: 'Show in Finder', action: () => reveal([img]) },
  ]
}
// each ad's row scrolls sideways when its formats do not fit; a fade on the cut edge says so
const rowEls = new Map<number, HTMLElement>()
const fades = ref<Record<number, { left: boolean; right: boolean }>>({})
function measure() {
  const next: Record<number, { left: boolean; right: boolean }> = {}
  for (const [i, el] of rowEls) next[i] = { left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }
  fades.value = next
}
const resize = new ResizeObserver(measure)
const setRowEl = (i: number, el: unknown) => {
  const old = rowEls.get(i)
  if (old === el) return
  if (old) resize.unobserve(old)
  if (el instanceof HTMLElement) { rowEls.set(i, el); resize.observe(el) } else rowEls.delete(i)
}
onMounted(measure)
onBeforeUnmount(() => resize.disconnect())
// the ad open in the panel stays in view when the row narrows beside it
watch(() => panel.value?.format, async () => {
  if (panel.value?.set !== props.set.id) return
  await nextTick()
  for (const el of rowEls.values()) el.querySelector('[data-open]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})
const fade = (i: number) => {
  const f = fades.value[i]
  if (!f || (!f.left && !f.right)) return {}
  return { maskImage: `linear-gradient(to right, ${f.left ? 'transparent, black 40px' : 'black'}, ${f.right ? 'black calc(100% - 40px), transparent' : 'black'})` }
}
const rate = (patch: Parameters<typeof change>[1]) => change(props.set, patch).catch(() => {})
// An ad whose file is still being written fails to load: keep the placeholder showing instead of a broken image and its
// alt text, and try again shortly, since the maker usually finishes within seconds.
const imgLoaded = (e: Event) => ((e.target as HTMLImageElement).style.visibility = '')
function imgFailed(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.visibility = 'hidden'
  const base = img.src.replace(/&retry=\d+$/, '')
  const tries = Number(/&retry=(\d+)$/.exec(img.src)?.[1] ?? 0)
  if (tries < 20) setTimeout(() => img.isConnected && (img.src = `${base}&retry=${tries + 1}`), 3000)
}
const writeNote = (ad: Ad) => { select(props.set.id, ad.format); noteFocus.value++ }
</script>

<template>
  <section class="rounded-md border border-line bg-raised" :aria-label="title" @contextmenu="openMenu($event, setMenu())">
    <header class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-3.5 pb-3 sm:px-5">
      <button type="button" class="min-w-0 shrink text-left max-sm:w-full" @click="panel = { set: set.id }">
        <h2 class="display truncate text-[15px] font-semibold hover:underline sm:text-lg"><span class="sm:hidden">{{ dateLabel(set, project.sets, true) }}</span><span class="max-sm:hidden">{{ title }}</span></h2>
      </button>
      <span v-if="set.status !== 'done'" class="status-tag" :title="set.status === 'working' ? 'The ads are still being reviewed and revised. Not every ad has had its three reviews yet.' : 'Work stopped before every ad had its three reviews.'">
        <span class="status-dot" :class="set.status" aria-hidden="true" />{{ set.status === 'working' ? 'In progress' : 'Unfinished' }}
      </span>
      <span class="text-[13px] whitespace-nowrap text-ink-3 max-sm:hidden">{{ ads.length === set.ads.length ? '' : `${ads.length} of ` }}{{ set.ads.length }} {{ set.ads.length === 1 ? 'ad' : 'ads' }}</span>
      <div class="ml-auto flex shrink-0 items-center gap-1 max-sm:ml-0 max-sm:w-full max-sm:flex-wrap sm:gap-2">
        <span v-if="filter === 'liked'" class="text-[12px] text-ink-3">Your favourite version of each ad</span>
        <div v-else-if="set.maxRound > 1" class="flex items-center gap-2">
          <span class="text-[12px] text-ink-3 max-sm:hidden">Version</span>
          <div class="seg" role="group" aria-label="Version">
            <button v-for="n in set.maxRound" :key="n" type="button" :aria-pressed="round === n" @click="chosenRound[set.id] = n">{{ n }}</button>
            <button v-if="hasCritic" type="button" :aria-pressed="round === BEST" title="Each ad at the version that won its blind test. Without one, the latest version, unless the critic scored an earlier version at least half a point higher" @click="chosenRound[set.id] = BEST">Smart Pick</button>
          </div>
        </div>
        <ScoreTable v-if="hasCritic || set.maxRound > 1" :set="set" />
        <RatingControl :value="set.feedback.set_rating" @change="rate({ setRating: $event })" />
        <button type="button" class="icon-btn" aria-label="Show run in Finder" title="Show in Finder" @click="reveal([set.id])">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M1.5 4.5v8a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3h-4a1 1 0 0 0-1 1.5Z" /></svg>
        </button>
        <button type="button" class="icon-btn" aria-label="More" title="More" @click="openMenu($event, setMenu())">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
        </button>
      </div>
    </header>
    <p v-if="!set.ads.length" class="px-4 pb-6 text-[13px] text-ink-2 sm:px-5">The first ads appear here as they're made.</p>
    <template v-for="([name, list], i) in rows" :key="name">
    <h3 v-if="rows.length > 1" class="truncate px-4 pb-2 text-[13px] font-medium text-ink-2 sm:px-5" :class="i > 0 && 'border-t border-line pt-3'">{{ rowName(name, list) }}</h3>
    <div :ref="(el) => setRowEl(i, el)" class="flex gap-3 overflow-x-auto px-4 pb-4 sm:px-5" :style="fade(i)" @scroll.passive="measure">
      <figure
        v-for="ad in list"
        :key="ad.format"
        class="group/item relative flex flex-col"
        :style="{ flex: `${shape(ad.format)} 1 0`, minWidth: `${Math.round(shape(ad.format) * 170)}px`, maxWidth: `${Math.round(shape(ad.format) * 420)}px` }"
        :data-open="isOpen(ad) || undefined"
        @contextmenu="openMenu($event, adMenu(ad))"
      >
        <button
          type="button"
          class="skeleton block overflow-hidden !rounded-sm outline-offset-2 transition-[outline-color] duration-150"
          :class="isOpen(ad) ? 'outline-2 outline-ring outline-solid' : 'outline-1 outline-transparent outline-solid hover:outline-line-strong'"
          :style="{ aspectRatio: aspect(ad.format) }"
          :aria-label="`Select ${ratio(ad.format)}`"
          :aria-pressed="isOpen(ad)"
          @click="select(set.id, ad.format)"
        >
          <img :src="thumbUrl(shown(ad).image)" :alt="ad.text?.headline ?? ''" class="relative z-[1] h-full w-full object-contain" loading="lazy" @load="imgLoaded" @error="imgFailed" />
        </button>
        <button
          type="button"
          class="absolute top-1.5 right-1.5 z-[2] flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-[#0b0b0e]/75 text-[#f4f4f5] opacity-0 shadow-md transition-opacity duration-150 hover:bg-[#0b0b0e]/90 group-hover/item:opacity-100 group-focus-within/item:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
          :aria-label="`Enlarge ${ratio(ad.format)}`"
          title="Enlarge"
          @click="enlarge(set.id, ad.format)"
        >
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25M7 5v4M5 7h4" /></svg>
        </button>
        <figcaption class="mt-1 flex h-7 items-center gap-1">
          <span class="text-[12px] font-medium tabular-nums">{{ ratio(ad.format) }}</span>
          <span v-if="shown(ad).n !== round || filter === 'liked'" class="text-[11px] text-ink-3">v{{ shown(ad).n }}</span>
          <span class="ml-auto flex items-center">
            <RatingControl quiet :value="fbOf(ad).rating" @change="rate({ format: ad.format, rating: $event, round: shown(ad).n })" />
            <button
              type="button"
              class="icon-btn !h-7 !w-7"
              :class="fbOf(ad).note ? 'text-ink' : 'text-ink-3'"
              :aria-label="fbOf(ad).note ? `Note on version ${shown(ad).n}` : `Write a note on version ${shown(ad).n}`"
              :title="fbOf(ad).note ?? `Write a note on version ${shown(ad).n}`"
              @click="writeNote(ad)"
            >
              <svg viewBox="0 0 16 16" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3 2.75h10v8.5H7l-3 2.5v-2.5H3z" stroke-linejoin="round" :fill="fbOf(ad).note ? 'currentColor' : 'none'" /></svg>
            </button>
          </span>
        </figcaption>
      </figure>
    </div>
    </template>
  </section>
</template>
