<script setup lang="ts">
// Shown once, the first time the page opens on this computer: what Parival sends and what it never sends, with the
// choice to turn statistics off. Nothing is sent before one of the two buttons is clicked.
import { answerNotice, app } from '../state'
</script>

<template>
  <div v-if="app && !app.noticeShown" class="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4">
    <section class="w-full max-w-lg rounded-lg border border-line-strong bg-raised p-6 shadow-[0_24px_80px_rgba(0,0,0,0.25)]" role="alertdialog" aria-modal="true" aria-labelledby="notice-title" aria-describedby="notice-text">
      <h2 id="notice-title" class="display text-lg font-semibold">Statistics</h2>
      <div id="notice-text" class="mt-3 space-y-3 text-[13px] leading-relaxed text-ink-2">
        <p>Parival sends Grownoli counts of what the plugin does on this computer: how many runs, ads and formats you make, how the blind comparisons end, how long a run takes, which kinds of error occur, and the versions of Parival, Node and your operating system.</p>
        <p>The counts carry a random ID made on this computer. The ID is not linked to your name, your email or your Claude account.</p>
        <p>Parival never sends websites, brand names, ad copy, pictures, file names or comments.</p>
        <p>You can turn statistics off now, or later in Settings.</p>
      </div>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn" @click="answerNotice(false)">Turn Off Statistics</button>
        <button type="button" class="btn-dark" autofocus @click="answerNotice(true)">OK</button>
      </div>
    </section>
  </div>
</template>
