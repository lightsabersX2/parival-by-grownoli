<script setup lang="ts">
// shadcn's SidebarTrigger: a ghost icon button at the top left of the content that hides and shows the sidebar
// (offcanvas), with lucide's panel-left icon and ⌘B, the same in both states so it is always findable.
import { sidebarFolded } from '../sidebar'
</script>

<template>
  <button
    type="button"
    class="icon-btn shrink-0 max-md:hidden"
    :aria-label="sidebarFolded ? 'Show Sidebar' : 'Hide Sidebar'"
    :aria-expanded="!sidebarFolded"
    :title="`${sidebarFolded ? 'Show' : 'Hide'} Sidebar (⌘B)`"
    @click="sidebarFolded = !sidebarFolded"
  >
    <svg viewBox="0 0 24 24" class="size-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></svg>
  </button>
</template>
