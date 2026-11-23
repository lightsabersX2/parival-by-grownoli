<script setup lang="ts">
import { computed, ref } from 'vue'
import { matchingProjects } from '../../server/merge.ts'
// The sidebar: the brands with their number of runs, and the
// appearance switch at the foot. On a phone it is a bar across the top.
import { settingsOpen } from '../keys'
import { openMenu } from '../menu'
import { currentProject, go, isNew, loaded, projectSort, projects, sortedProjects } from '../state'
import { THEMES, setTheme, theme } from '../theme'
import { projectsHidden, sidebarFolded } from '../sidebar'

// the list scrolls inside the sidebar and a search box narrows it
const query = ref('')
const shown = computed(() => matchingProjects(sortedProjects.value, query.value))
const themeMenu = (e: MouseEvent) => openMenu(e, THEMES.map(([t, label]) => ({ label, checked: theme.value === t, action: () => setTheme(t) })))
const item = (on: boolean) => [
  'flex h-8 shrink-0 items-center gap-2 rounded-md px-2.5 text-left text-[13px] whitespace-nowrap transition-colors',
  on ? 'bg-selected font-medium text-ink' : 'text-ink-2 hover:bg-hover hover:text-ink',
]
</script>

<template>
  <aside :class="sidebarFolded && 'md:hidden'" class="relative flex shrink-0 flex-col gap-3 border-line bg-sidebar px-3 py-3 max-md:border-b md:sticky md:top-0 md:h-screen md:w-60 md:border-r md:py-5">
    <button type="button" class="group absolute inset-y-0 -right-2 z-10 hidden w-4 cursor-w-resize md:block" aria-label="Hide Sidebar" title="Hide Sidebar (⌘B)" tabindex="-1" @click="sidebarFolded = true">
      <span class="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-line-strong" aria-hidden="true" />
    </button>
    <div class="flex items-center gap-3 md:flex md:min-h-0 md:flex-1 md:flex-col md:items-stretch md:gap-0">
      <div class="flex shrink-0 items-center gap-2.5 px-2.5 md:mb-5">
        <svg viewBox="0 0 64 64" class="h-7 w-7 shrink-0 rounded-[6px] ring-1 ring-line-strong" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#17171d" /><path d="M13.5 32.5c0-12 8-21 20-21 6 0 10 2 13 5l-6 7c-2-2-4-3-7-3-6 0-10 5-10 12s4 12 10 12c3 0 6-1 8-3v-5H31.5v-8h19v17c-4 4-10 7-17 7-12 0-20-8-20-20Z" fill="#f8fafc" /></svg>
        <p class="display text-[17px] leading-tight font-bold">Parival<span class="block text-[11px] font-medium tracking-normal text-ink-3 max-md:hidden">by Grownoli</span></p>
      </div>
      <nav class="flex min-w-0 flex-1 gap-0.5 overflow-x-auto md:min-h-0 md:flex-col md:overflow-visible" aria-label="Projects">
        <div class="flex items-center justify-between pr-1 max-md:hidden">
        <button type="button" class="label flex items-center gap-1 rounded-sm px-2.5 pb-1 hover:text-ink" :aria-expanded="!projectsHidden" @click="projectsHidden = !projectsHidden">
          Projects
          <svg viewBox="0 0 16 16" class="h-3 w-3 transition-transform duration-150" :class="projectsHidden && '-rotate-90'" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 6.5 3.5 3.5 3.5-3.5" /></svg>
        </button>
        <button v-show="!projectsHidden" type="button" class="label rounded-sm px-1.5 pb-1 normal-case tracking-normal hover:text-ink" :title="projectSort === 'recent' ? 'Sorted by latest run. Click to sort by name.' : 'Sorted by name. Click to sort by latest run.'" @click="projectSort = projectSort === 'recent' ? 'name' : 'recent'">{{ projectSort === 'recent' ? 'Recent' : 'A to Z' }}</button>
        </div>
        <label v-show="!projectsHidden && loaded" class="mx-1 mb-1.5 flex h-7 shrink-0 items-center gap-1.5 rounded-md bg-hover px-2 text-ink-3 focus-within:ring-2 focus-within:ring-ring max-md:hidden">
          <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="7" cy="7" r="4.25" /><path d="m10.25 10.25 3.25 3.25" /></svg>
          <input v-model="query" type="search" placeholder="Search" aria-label="Search Projects" class="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 focus-visible:outline-none" @keydown.esc="query = ''" />
        </label>
        <p v-if="projectsHidden && loaded" class="px-2.5 text-[12px] text-ink-3 max-md:hidden">{{ projects.length }} hidden</p>
        <template v-if="!loaded">
          <div v-for="w in [70, 52, 84, 60, 46, 74]" :key="w" class="skeleton mx-2.5 my-2.5 h-3 shrink-0 max-md:w-16" :style="{ width: `${w}%` }" aria-hidden="true" />
        </template>
        <div class="max-md:contents md:-mx-1 md:flex md:min-h-0 md:flex-1 md:flex-col md:gap-0.5 md:overflow-y-auto md:px-1">
        <p v-if="query && !shown.length && !projectsHidden" class="px-2.5 py-1.5 text-[12px] text-ink-3 max-md:hidden">No matching projects</p>
        <button
          v-for="p in shown"
          v-show="!projectsHidden"
          :key="p.key"
          type="button"
          :class="item(currentProject?.key === p.key)"
          :aria-current="currentProject?.key === p.key ? 'page' : undefined"
          @click="go(p.key)"
        >
          <span class="min-w-0 truncate" :class="isNew(p) && 'font-semibold text-ink'">{{ p.name }}</span>
          <span v-if="isNew(p) && currentProject?.key !== p.key" class="new-badge ml-auto">New</span>
          <span v-else class="ml-auto text-[11px] tabular-nums text-ink-3">{{ p.sets.length }}</span>
        </button>
        </div>
      </nav>
      <button type="button" class="icon-btn shrink-0 md:hidden" aria-label="Appearance" title="Appearance" aria-haspopup="menu" @click="themeMenu">
        <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="8" r="5.75" /><path d="M8 2.25v11.5A5.75 5.75 0 0 0 8 2.25Z" fill="currentColor" /></svg>
      </button>
    </div>
    <div class="flex shrink-0 flex-col gap-3 border-line pt-3 max-md:hidden md:mt-auto md:border-t">
      <button type="button" class="flex h-8 items-center gap-2 rounded-md px-2.5 text-[13px] text-ink-2 hover:bg-hover hover:text-ink" @click="settingsOpen = true">
        Settings<kbd class="kbd ml-auto">⌘,</kbd>
      </button>
    <div class="seg self-center" role="group" aria-label="Appearance">
      <button v-for="[t, label] in THEMES" :key="t" type="button" class="flex items-center gap-1.5" :aria-pressed="theme === t" :aria-label="label" :title="label" @click="setTheme(t)">
        <svg viewBox="0 0 16 16" class="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true">
          <template v-if="t === 'light'"><circle cx="8" cy="8" r="2.75" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.06 1.06M11.54 11.54l1.06 1.06M3.4 12.6l1.06-1.06M11.54 4.46l1.06-1.06" /></template>
          <path v-else-if="t === 'dark'" d="M13.25 9.6A5.5 5.5 0 1 1 6.4 2.75a4.5 4.5 0 0 0 6.85 6.85Z" stroke-linejoin="round" />
          <template v-else><circle cx="8" cy="8" r="5.75" /><path d="M8 2.25v11.5A5.75 5.75 0 0 0 8 2.25Z" fill="currentColor" /></template>
        </svg>
        <span v-if="theme === t">{{ label }}</span>
      </button>
    </div>
    </div>
  </aside>
</template>
