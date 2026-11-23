<script setup lang="ts">
// The donation ask: a small card in the corner, shown only after the person has opened a finished run and closed what
// they were doing, on the schedule the page's server keeps. It never covers a note or a comment being written.
import { computed, watch } from 'vue'
import { settingsOpen } from '../keys'
import { app, loops, openPin, panel, supportAnswer, supportAsk, zoom } from '../state'

const quiet = computed(() => !panel.value && !zoom.value && !loops.value && !openPin.value && !settingsOpen.value && !!app.value?.noticeShown)
const open = computed(() => supportAsk.value && quiet.value)
watch(open, (now, before) => { if (now && !before) void supportAnswer('shown') })
const close = () => (supportAsk.value = false)
function supported() {
  void supportAnswer('supported')
  close()
}
</script>

<template>
  <aside v-if="open && app" class="fixed right-4 bottom-4 z-[65] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-line-strong bg-raised p-4 shadow-[0_16px_48px_rgba(0,0,0,0.2)]" role="dialog" aria-labelledby="support-title">
    <h2 id="support-title" class="display text-[15px] font-semibold">{{ app.supported ? 'Thank you for supporting Parival' : 'Parival is free' }}</h2>
    <p class="mt-1.5 text-[13px] leading-relaxed text-ink-2">{{ app.supported ? 'A further contribution keeps its development going and unlocks nothing.' : 'A contribution helps its development and unlocks nothing.' }}</p>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <a :href="app.supportUrl" target="_blank" rel="noopener noreferrer" class="btn-dark" @click="close">Contribute</a>
      <button type="button" class="btn" @click="close">Not Now</button>
      <button v-if="!app.supported" type="button" class="btn" @click="supported">Already Supported</button>
    </div>
  </aside>
</template>
