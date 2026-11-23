<script setup lang="ts">
// The right-click menu, without submenus: at the pointer, kept inside the window, closed by a click outside,
// Escape, scrolling or a choice. Arrow keys move, Return chooses, as in a macOS menu.
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { closeMenu, menu, type MenuItem } from '../menu'

const el = ref<HTMLElement | null>(null)
const pos = ref({ left: 0, top: 0 })
const active = ref(-1)
const items = computed<MenuItem[]>(() => menu.value?.items ?? [])

watch(menu, async (m) => {
  document.removeEventListener('pointerdown', onOutside, true)
  if (!m) return
  active.value = -1
  pos.value = { left: m.x, top: m.y }
  await nextTick()
  const r = el.value?.getBoundingClientRect()
  if (r) pos.value = { left: Math.max(8, Math.min(m.x, innerWidth - r.width - 8)), top: Math.max(8, Math.min(m.y, innerHeight - r.height - 8)) }
  el.value?.focus()
  document.addEventListener('pointerdown', onOutside, true)
})
function onOutside(e: PointerEvent) {
  if (!el.value?.contains(e.target as Node)) closeMenu()
}
function choose(item: MenuItem) {
  if (!('action' in item)) return
  closeMenu()
  item.action()
}
function move(dir: number) {
  const list = items.value
  for (let n = 1; n <= list.length; n++) {
    const i = (active.value + dir * n + list.length) % list.length
    if ('action' in list[i]) return void (active.value = i)
  }
}
function onKey(e: KeyboardEvent) {
  e.stopPropagation()
  if (e.key === 'Escape') closeMenu()
  else if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
  else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
  else if (e.key === 'Enter' && active.value >= 0) (e.preventDefault(), choose(items.value[active.value]))
}
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="menu"
      ref="el"
      class="fixed z-[120] min-w-52 rounded-lg border border-line-strong bg-raised py-1 text-[13px] shadow-[0_8px_28px_rgba(0,0,0,0.18)] outline-none"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
      role="menu"
      tabindex="-1"
      @keydown="onKey"
      @wheel.passive="closeMenu"
      @contextmenu.prevent
    >
      <template v-for="(item, i) in items" :key="i">
        <div v-if="'separator' in item" class="mx-2.5 my-1 h-px bg-line" role="separator"></div>
        <button
          v-else
          type="button"
          role="menuitem"
          class="mx-1 flex w-[calc(100%-0.5rem)] items-center rounded px-1.5 py-1 text-left text-ink"
          :class="active === i ? 'bg-selected' : 'hover:bg-hover'"
          @pointerenter="active = i"
          @click="choose(item)"
        ><span class="w-4 shrink-0 text-xs" aria-hidden="true">{{ item.checked ? '✓' : '' }}</span>{{ item.label }}</button>
      </template>
    </div>
  </Teleport>
</template>
