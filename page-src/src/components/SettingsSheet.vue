<script setup lang="ts">
// Settings: the look of the page, where to get help, what the page is and its licence, the statistics switch with its
// report, the contribution link, and every keyboard shortcut. Opens with ⌘, or ⌘/ and from the sidebar.
import { SHORTCUTS, settingsOpen } from '../keys'
import { app, setStatistics } from '../state'
import { THEMES, setTheme, theme } from '../theme'

const VERSION = __VERSION__
</script>

<template>
  <div v-if="settingsOpen" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4" @click.self="settingsOpen = false" @keydown.esc.stop="settingsOpen = false">
    <section class="flex max-h-full w-full max-w-xl md:max-w-4xl flex-col rounded-lg border border-line-strong bg-raised shadow-[0_24px_80px_rgba(0,0,0,0.25)]" role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <header class="flex items-center border-b border-line px-5 py-3">
        <h2 id="settings-title" class="display flex-1 text-lg font-semibold">Settings</h2>
        <button type="button" class="icon-btn" aria-label="Close" title="Close (Esc)" autofocus @click="settingsOpen = false">
          <svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      <div class="grid gap-x-10 gap-y-5 overflow-y-auto px-5 py-5 md:grid-cols-2">
        <div class="flex items-center gap-4 md:col-span-2">
          <h3 class="label w-28">Appearance</h3>
          <div class="seg" role="group" aria-label="Appearance">
            <button v-for="[t, label] in THEMES" :key="t" type="button" :aria-pressed="theme === t" @click="setTheme(t)">{{ label }}</button>
          </div>
        </div>
        <div class="flex items-baseline gap-4 md:col-span-2">
          <h3 class="label w-28 shrink-0">Support</h3>
          <p class="text-[13px] text-ink-2">For help, or to get in touch, write to <a href="mailto:hello@grownoli.com" class="font-medium text-ink underline underline-offset-2">hello@grownoli.com</a>.</p>
        </div>
        <div class="flex items-baseline gap-4 md:col-span-2">
          <h3 class="label w-28 shrink-0">About</h3>
          <div class="space-y-1 text-[13px] text-ink-2">
            <p><span class="font-medium text-ink">Parival by Grownoli</span>, version {{ app?.version ?? VERSION }}</p>
            <p v-if="app?.latest" class="font-medium text-ink" role="status">Version {{ app.latest }} is available. Update the plugin in Claude Code.</p>
            <p>Copyright 2026 Adam Lithner</p>
            <p>Open source under the Apache License 2.0</p>
            <p>This page runs on this computer. Parival sends Grownoli the statistics below while they are on, and asks Grownoli which version is the latest. Parival sends nothing else.</p>
            <p class="flex flex-wrap gap-x-4 pt-1">
              <a href="/about/licence.txt" target="_blank" rel="noopener" class="font-medium text-ink underline underline-offset-2">Licence</a>
              <a href="/about/third-party-notices.txt" target="_blank" rel="noopener" class="font-medium text-ink underline underline-offset-2">Third-party notices</a>
            </p>
          </div>
        </div>
        <div v-if="app" class="flex items-baseline gap-4 md:col-span-2">
          <h3 class="label w-28 shrink-0">Statistics</h3>
          <div class="space-y-1.5 text-[13px] text-ink-2">
            <label class="flex items-center gap-2 font-medium text-ink"><input type="checkbox" class="h-4 w-4 accent-[var(--ink)]" :checked="app.statistics" @change="setStatistics(($event.target as HTMLInputElement).checked)" />Share statistics</label>
            <p>Parival sends Grownoli counts of what the plugin does, such as runs, ads, formats and errors, with a random ID made on this computer. The ID is not linked to your name, your email or your Claude account. Turning statistics off deletes the ID.</p>
            <p><a href="/api/report" target="_blank" rel="noopener" class="font-medium text-ink underline underline-offset-2">Statistics Report</a></p>
          </div>
        </div>
        <div v-if="app" class="flex items-baseline gap-4 md:col-span-2">
          <h3 class="label w-28 shrink-0">Contribution</h3>
          <div class="space-y-2 text-[13px] text-ink-2">
            <p>Parival is free. A contribution helps its development and unlocks nothing.</p>
            <a :href="app.supportUrl" target="_blank" rel="noopener noreferrer" class="btn">Contribute</a>
          </div>
        </div>
        <div v-for="g in SHORTCUTS" :key="g.group">
          <h3 class="label mb-2">{{ g.group }}</h3>
          <dl class="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            <template v-for="[keys, what] in g.keys" :key="what + keys.join()">
              <dt class="flex flex-wrap items-start gap-1 self-start"><kbd v-for="k in keys" :key="k" class="kbd">{{ k }}</kbd></dt>
              <dd class="text-ink-2">{{ what }}</dd>
            </template>
          </dl>
        </div>
      </div>
    </section>
  </div>
</template>
