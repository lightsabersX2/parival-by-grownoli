<script setup lang="ts">
// The project page while the list loads: the title, then rounds with a row of ads each, in the place and size the
// real ones take, so nothing jumps when they arrive.
const WIDTHS = [1, 0.8, 0.5625, 1.78, 1.33]
</script>

<template>
  <div class="mx-auto max-w-7xl space-y-5" aria-hidden="true">
    <div class="space-y-2.5 pb-1">
      <div class="skeleton h-8 w-72 max-w-full" />
      <div class="skeleton h-3 w-52" />
    </div>
    <div v-for="r in 2" :key="r" class="rounded-md border border-line bg-raised px-4 pt-4 pb-4 sm:px-5">
      <div class="mb-3.5 flex items-center gap-4">
        <div class="skeleton h-4 w-44" />
        <div class="skeleton ml-auto h-6 w-28" />
      </div>
      <div class="flex gap-3 overflow-hidden">
        <div v-for="(w, i) in WIDTHS" :key="i" class="skeleton h-[170px] shrink-0" :style="{ width: `${Math.round(w * 170)}px` }" />
      </div>
    </div>
  </div>
</template>
