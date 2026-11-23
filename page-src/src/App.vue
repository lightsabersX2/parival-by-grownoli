<script setup lang="ts">
// The gallery: projects in the sidebar, a project's rounds newest first, the detail panel on the right. New rounds
// found while the page is open wait behind a banner, so the list never changes under the pointer.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import ContextMenu from './components/ContextMenu.vue'
import DetailPanel from './components/DetailPanel.vue'
import FullView from './components/FullView.vue'
import LoopsView from './components/LoopsView.vue'
import FirstNotice from './components/FirstNotice.vue'
import SupportPrompt from './components/SupportPrompt.vue'
import SetRow from './components/SetRow.vue'
import SettingsSheet from './components/SettingsSheet.vue'
import SkeletonRows from './components/SkeletonRows.vue'
import SidebarTrigger from './components/SidebarTrigger.vue'
import { onKey, settingsOpen } from './keys'
import { check, loadApp, currentProject, lastAction, filter, matches, shownFor, versionFeedback, dateLabel, load, loadFailed, loaded, updates, panel, saveError, showPending, reveal, clientFolders } from './state'

const project = computed(() => currentProject.value)
const FILTERS = [['all', 'All'], ['unrated', 'Unrated'], ['liked', 'My Favourites']] as const
// a run whose first ads are still being made shows under All, so a new company is visible at once
const shownSets = computed(() => project.value?.sets.filter((s) => (!s.ads.length && filter.value === 'all') || s.ads.some((a) => matches(versionFeedback(s, a.format, shownFor(s, a).n).rating, filter.value))) ?? [])
// "A new run in Harbour Bakery", "New versions in Harbour Bakery and 2 other projects"
const updateText = computed(() => {
  const [u, ...rest] = updates.value
  if (!u) return ''
  const what = u.kind === 'run' ? `A new run in ${u.name}` : `New versions in ${u.name}`
  return rest.length ? `${what} and ${rest.length === 1 ? '1 other project' : `${rest.length} other projects`}` : what
})
const latest = computed(() => (project.value?.sets[0] ? dateLabel(project.value.sets[0]) : ''))
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  void load()
  void loadApp()
  timer = setInterval(check, 10_000)
  window.addEventListener('focus', check)
  window.addEventListener('keydown', onKey, true)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('focus', check)
  window.removeEventListener('keydown', onKey, true)
})
// the undo note fades after a few seconds
const toast = ref<string | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | undefined
watch(lastAction, (a) => { toast.value = a?.text ?? null; clearTimeout(toastTimer); toastTimer = setTimeout(() => (toast.value = null), 3000) })
</script>

<template>
  <div class="flex min-h-screen max-md:flex-col">
    <AppSidebar />
    <main class="min-w-0 flex-1 px-4 py-5 sm:px-8 sm:py-7" :class="panel && 'min-[1500px]:mr-[440px]'">
      <div v-if="updates.length" class="mb-5 flex items-center justify-between gap-3 rounded-md border border-line bg-raised px-4 py-2.5 text-[13px]" role="status">
        <span>{{ updateText }}</span>
        <button type="button" class="btn !h-8" @click="showPending">{{ updates.length > 1 ? `Show ${updates[0].name}` : 'Show' }}</button>
      </div>
      <p v-if="saveError" class="mb-4 text-[13px] text-ink-2" role="status">Couldn't save. Try again.</p>

      <p v-if="!loaded" class="sr-only" role="status">Loading ads</p>
      <SkeletonRows v-if="!loaded" />
      <p v-else-if="loaded && loadFailed" class="text-ink-2">Couldn't read the ads. Reload the page.</p>
      <div v-else-if="loaded && !project" class="max-w-md pt-10">
        <h1 class="display text-[28px] font-extrabold">No ads yet</h1>
        <p class="text-ink-2">Ask Claude for a campaign. Each run appears here as its ads are made.</p>
      </div>
      <div v-else-if="project" class="mx-auto max-w-7xl space-y-5">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SidebarTrigger class="-ml-2 self-start mt-1.5" />
          <div class="min-w-0 flex-1 max-sm:w-full max-sm:flex-none">
            <h1 class="display truncate text-[32px] leading-tight font-extrabold">{{ project.name }}</h1>
            <p class="truncate text-[13px] text-ink-2">{{ project.sets.length === 1 ? '1 run' : `${project.sets.length} runs` }}, latest {{ latest }}<button type="button" aria-label="Show in Finder" class="ml-2 text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink" title="Opens this brand's runs in Finder" @click="reveal(clientFolders(project))">Show in Finder</button></p>
          </div>
          <div class="seg" role="group" aria-label="Show ads">
            <button v-for="[f, label] in FILTERS" :key="f" type="button" :aria-pressed="filter === f" @click="filter = f">{{ label }}</button>
          </div>
        </div>
        <SetRow v-for="s in shownSets" :key="s.id" :set="s" :project="project" />
        <p v-if="!shownSets.length" class="py-6 text-[13px] text-ink-2">{{ filter === 'liked' ? 'No favourites yet. Give an ad a thumbs up or a star.' : 'Every ad has a rating.' }}</p>
      </div>
      <button type="button" class="mt-8 text-[13px] text-ink-2 underline underline-offset-2 md:hidden" @click="settingsOpen = true">About and Support</button>
    </main>
    <DetailPanel />
    <FullView />
    <LoopsView />
    <SupportPrompt />
    <FirstNotice />
    <ContextMenu />
    <SettingsSheet />
    <p v-if="toast" class="fixed top-4 left-1/2 z-[70] -translate-x-1/2 rounded-md bg-ink px-4 py-2 text-[13px] text-raised shadow-lg" role="status">{{ toast }}</p>
  </div>
</template>
