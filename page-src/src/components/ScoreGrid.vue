<script setup lang="ts">
// A round's scores: the critic's overall average and its average per criterion for each version, then how many ads
// the person gave each rating. The last column, the Smart Pick, takes each ad at the version the critic scored highest for it.
import { computed } from 'vue'
import { criteriaTable, shownVersions } from '../../server/feedback.ts'
import type { AdSet } from '../../server/types.ts'
import { scoreLabel } from '../state'

const props = defineProps<{ set: AdSet }>()
const table = computed(() => criteriaTable(props.set))
const scored = computed(() => Object.keys(table.value.criteria).length > 0)
// the three latest versions and the Smart Pick, so the table keeps one width however many loops a run has
const versions = computed(() => [...shownVersions(props.set.maxRound), ...(scored.value ? [0] : [])])
const fmt = (v?: number) => (v === undefined ? '–' : v.toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
// the highest shown version in a row is bold; the Smart Pick is set apart by its column, not compared
const top = (row: Record<number, number>) => Math.max(...versions.value.filter((n) => n !== 0 && row[n] !== undefined).map((n) => row[n]))
const cell = (row: Record<number, number>, n: number) => [
  'py-1 pr-3 pl-3 text-right tabular-nums',
  n === 0 ? 'bg-hover font-semibold' : row[n] !== undefined && row[n] === top(row) && props.set.maxRound > 1 ? 'font-semibold' : 'text-ink-2',
]
const RATINGS = [['star', 'Star'], ['up', 'Thumbs up'], ['down', 'Thumbs down']] as const
</script>

<template>
  <table class="w-full border-collapse text-[12.5px]">
    <thead>
      <tr class="text-ink-3">
        <th class="pb-1.5 text-left font-medium">{{ scored ? 'Critic average, out of 5' : 'The critic has not scored this run' }}</th>
        <th v-for="n in versions" :key="n" class="pr-3 pb-1.5 pl-3 text-right font-medium" :class="n === 0 && 'rounded-t-sm bg-hover text-ink-2'" :title="n ? '' : 'Each ad at the version that won its blind test. Without one, the latest version, unless the critic scored an earlier version at least half a point higher'">{{ n ? `v${n}` : 'Smart Pick' }}</th>
      </tr>
    </thead>
    <tbody v-if="scored">
      <tr class="border-b border-line text-[13.5px]">
        <th class="py-1.5 text-left font-semibold">Average</th>
        <td v-for="n in versions" :key="n" :class="[cell(table.overall, n), 'py-1.5 text-ink font-semibold']">{{ fmt(table.overall[n]) }}</td>
      </tr>
      <tr v-for="(per, k) in table.criteria" :key="k">
        <td class="py-1 pr-2">{{ scoreLabel(String(k)) }}</td>
        <td v-for="n in versions" :key="n" :class="cell(per, n)">{{ fmt(per[n]) }}</td>
      </tr>
    </tbody>
    <tbody>
      <tr class="text-ink-3"><th class="pt-3 pb-1 text-left font-medium">Your ratings, number of ads</th><td v-for="n in versions" :key="n" :class="n === 0 && 'bg-hover'"></td></tr>
      <tr v-for="[r, label] in RATINGS" :key="r">
        <td class="py-1">{{ label }}</td>
        <td v-for="n in versions" :key="n" class="py-1 pr-3 pl-3 text-right tabular-nums" :class="[table.ratings[n]?.[r] ? '' : 'text-ink-3', n === 0 && 'bg-hover', n === 0 && r === 'down' && 'rounded-b-sm']">{{ table.ratings[n]?.[r] ?? 0 }}</td>
      </tr>
    </tbody>
  </table>
</template>
