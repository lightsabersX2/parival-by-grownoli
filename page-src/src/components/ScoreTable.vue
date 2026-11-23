<script setup lang="ts">
// A round at a glance in a pop-over under its button; a click outside or Esc closes it.
import { onBeforeUnmount, ref } from 'vue'
import type { AdSet } from '../../server/types.ts'
import ScoreGrid from './ScoreGrid.vue'

const props = defineProps<{ set: AdSet }>()
const open = ref(false)
const root = ref<HTMLElement | null>(null)
function outside(e: Event) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false
}
function key(e: KeyboardEvent) {
  if (open.value && e.key === 'Escape') { open.value = false; e.stopImmediatePropagation() }
}
window.addEventListener('pointerdown', outside)
window.addEventListener('keydown', key, true)
onBeforeUnmount(() => { window.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', key, true) })
</script>

<template>
  <div ref="root" class="relative">
    <button type="button" class="icon-btn" :aria-expanded="open" aria-label="Scores per Version" title="Scores per Version" @click="open = !open">
      <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M3 13.5V9M8 13.5V3M13 13.5V6.5" /></svg>
    </button>
    <div v-if="open" class="absolute top-full right-0 z-40 mt-1.5 w-[30rem] max-sm:fixed max-sm:inset-x-4 max-sm:top-28 max-sm:w-auto rounded-md border border-line-strong bg-raised p-4 shadow-[0_12px_40px_rgba(0,0,0,0.16)]" role="dialog" aria-label="Scores per version">
      <ScoreGrid :set="set" />
    </div>
  </div>
</template>
