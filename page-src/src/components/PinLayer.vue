<script setup lang="ts">
// An ad's image with comments pinned to spots on it, as in ChatGPT Images and Claude Design: a click on the image
// places a numbered bubble and opens a field, a click on a bubble opens it again to edit or remove. Pins belong to the
// version shown. Enter saves, Shift+Enter makes a new line, Esc closes without saving; empty text removes the pin.
import { computed, nextTick, ref, watch } from 'vue'
import type { AdSet, Pin } from '../../server/types.ts'
import { change, openPin, versionFeedback } from '../state'

const props = defineProps<{ set: AdSet; format: string; n: number; src: string; alt: string; where: 'panel' | 'full'; imgClass?: string; imgStyle?: Record<string, string> }>()
// plain copies, so a saved list never carries the page's reactive wrappers
const pins = computed(() => (versionFeedback(props.set, props.format, props.n).pins ?? []).map((p) => ({ ...p })))
const draft = ref<Pin | null>(null)
const text = ref('')
const field = ref<HTMLTextAreaElement | null>(null)
const mine = computed(() => openPin.value?.where === props.where ? openPin.value : null)

watch(mine, async (o) => {
  draft.value = o ? (pins.value.find((p) => p.id === o.id) ?? (o.at ? { id: o.id, ...o.at, text: '' } : null)) : null
  text.value = draft.value?.text ?? ''
  await nextTick()
  field.value?.focus()
}, { immediate: true })
watch(() => [props.format, props.n], () => (openPin.value = null))

function place(e: MouseEvent) {
  const box = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const at = { x: round((e.clientX - box.left) / box.width), y: round((e.clientY - box.top) / box.height) }
  openPin.value = { id: Math.random().toString(36).slice(2, 9), where: props.where, at }
}
const round = (v: number) => Math.min(1, Math.max(0, Math.round(v * 1000) / 1000))
async function save() {
  const d = draft.value
  if (!d) return
  const t = text.value.trim()
  const known = pins.value.some((p) => p.id === d.id)
  const next = !t ? pins.value.filter((p) => p.id !== d.id) : known ? pins.value.map((p) => (p.id === d.id ? { ...p, text: t } : p)) : [...pins.value, { ...d, text: t }]
  openPin.value = null
  if (t !== (pins.value.find((p) => p.id === d.id)?.text ?? '')) await change(props.set, { format: props.format, round: props.n, pins: next }).catch(() => {})
}
const remove = () => { text.value = ''; void save() }
function key(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void save() }
  else if (e.key === 'Escape') { e.preventDefault(); openPin.value = null }
}
const number = (p: Pin) => (pins.value.findIndex((x) => x.id === p.id) + 1) || pins.value.length + 1
// the field opens on the side of the pin with more room
const side = (p: Pin) => ({ left: `${p.x * 100}%`, top: `${p.y * 100}%`, transform: `translate(${p.x > 0.55 ? 'calc(-100% - 14px)' : '14px'}, ${p.y > 0.6 ? 'calc(-100% + 12px)' : '-12px'})` })
</script>

<template>
  <div class="relative inline-block max-h-full max-w-full leading-none">
    <img :src="src" :alt="alt" :class="imgClass" :style="imgStyle" class="cursor-crosshair" draggable="false" @click="place" />
    <button
      v-for="p in pins"
      :key="p.id"
      type="button"
      class="absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full rounded-bl-none border-2 border-white bg-[#ff6d56] px-1 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] transition-transform duration-150 hover:scale-110"
      :class="draft?.id === p.id && 'scale-110 ring-2 ring-[#ff6d56]/40'"
      :style="{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }"
      :aria-label="`Comment ${number(p)}: ${p.text}`"
      :title="p.text"
      @click.stop="openPin = { id: p.id, where }"
    >{{ number(p) }}</button>
    <span
      v-if="draft && !pins.some((p) => p.id === draft!.id)"
      class="pointer-events-none absolute flex h-6 min-w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full rounded-bl-none border-2 border-white bg-[#ff6d56] px-1 text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      :style="{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%` }"
      aria-hidden="true"
    >{{ pins.length + 1 }}</span>
    <div v-if="draft" class="absolute z-10 w-64 rounded-md border border-line-strong bg-raised p-2.5 text-left leading-normal text-ink shadow-[0_12px_32px_rgba(0,0,0,0.25)]" :style="side(draft)" @click.stop>
      <label class="mb-1.5 block text-[12px] font-semibold">Comment {{ number(draft) }} on version {{ n }}</label>
      <textarea ref="field" v-model="text" rows="3" class="field block w-full resize-none px-2.5 py-1.5 text-[13px]" placeholder="What should change here?" @keydown="key"></textarea>
      <div class="mt-2 flex items-center gap-2">
        <button v-if="pins.some((p) => p.id === draft!.id)" type="button" class="text-[12px] text-ink-2 underline underline-offset-2 hover:text-ink" @click="remove">Delete</button>
        <button type="button" class="btn ml-auto !h-7 !px-2.5 !text-[12px]" @click="openPin = null">Cancel</button>
        <button type="button" class="btn-primary !h-7 !px-2.5 !text-[12px]" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>
