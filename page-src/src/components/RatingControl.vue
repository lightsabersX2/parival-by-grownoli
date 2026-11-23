<script setup lang="ts">
// The verdict as one scale, each step one click: thumbs down, thumbs up, star (a keeper). A click on the set
// step clears it. `quiet` (in rows) shows only the set step, so it sits at the end beside "…", and the rest while
// the pointer or keyboard is on the item.
import { RATING_MEANING, type Rating } from '../../server/types.ts'

const props = defineProps<{ value?: Rating; quiet?: boolean }>()
const emit = defineEmits<{ change: [value: Rating] }>()
const STEPS = ['down', 'up', 'star'] as const
const LABEL = { down: ['Thumbs Down', 'Remove Thumbs Down'], up: ['Thumbs Up', 'Remove Thumbs Up'], star: ['Star', 'Remove Star'] }
const pick = (s: (typeof STEPS)[number]) => emit('change', props.value === s ? null : s)
</script>

<template>
  <span class="inline-flex shrink-0 items-center" role="group" aria-label="Rating">
    <button
      v-for="s in STEPS"
      :key="s"
      type="button"
      class="h-7 w-7 items-center justify-center rounded transition-[color,opacity,background-color] duration-150 hover:bg-hover"
      :class="[
        value === s ? (s === 'star' ? 'text-star' : 'text-ink') : 'text-ink-3 hover:text-ink',
        quiet && value !== s ? 'hidden group-hover/item:inline-flex group-focus-within/item:inline-flex' : 'inline-flex',
      ]"
      :aria-pressed="value === s"
      :aria-label="LABEL[s][value === s ? 1 : 0]"
      :title="`${LABEL[s][value === s ? 1 : 0]}: ${RATING_MEANING[s]}`"
      @click.stop="pick(s)"
    >
      <svg v-if="s === 'star'" viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 1.9l1.8 3.75 4.1.55-3 2.85.75 4.07L8 11.15l-3.65 1.97.75-4.07-3-2.85 4.1-.55Z" :fill="value === s ? 'currentColor' : 'none'" />
      </svg>
      <svg v-else viewBox="0 0 16 16" class="h-4 w-4" :class="s === 'down' && '-scale-y-100'" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">
        <rect x="1.75" y="7" width="2.5" height="7" rx="0.75" :fill="value === s ? 'currentColor' : 'none'" />
        <path d="M6 13.25V7.6l2.6-4.7a1.2 1.2 0 0 1 2.2.85L10.3 6.5h2.4a1.5 1.5 0 0 1 1.47 1.8l-.85 4.3a1.6 1.6 0 0 1-1.57 1.3H6.75a.75.75 0 0 1-.75-.65Z" :fill="value === s ? 'currentColor' : 'none'" />
      </svg>
    </button>
  </span>
</template>
