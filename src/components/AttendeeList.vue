<script setup lang="ts">
import { computed } from 'vue';
import type { Attendee } from '@/stores/event';
import type { Attendance } from '@/stores/session';

const props = defineProps<{ attendees: Attendee[] }>();

const grouped = computed(() => {
  const out: Record<Attendance, Attendee[]> = { attending: [], maybe: [], no_go: [] };
  for (const a of props.attendees) out[a.attendance].push(a);
  return out;
});

const totalAttending = computed(() => {
  return grouped.value.attending.reduce((sum, a) => sum + 1 + (a.plusOne ? 1 : 0), 0);
});

const SECTION_LABELS: Record<Attendance, string> = {
  attending: 'Attending',
  maybe: 'Maybe',
  no_go: 'No-Go Traitor Scumbags',
};
</script>

<template>
  <section class="card space-y-3">
    <header class="flex items-baseline justify-between">
      <h2 class="text-xl">Who's coming</h2>
      <span class="text-sm text-muted">{{ totalAttending }} confirmed (incl. +1s)</span>
    </header>

    <div v-for="kind in (['attending', 'maybe', 'no_go'] as const)" :key="kind" class="space-y-1">
      <h3 class="text-sm uppercase tracking-wider text-muted">
        {{ SECTION_LABELS[kind] }} · {{ grouped[kind].length }}
      </h3>
      <ul v-if="grouped[kind].length" class="flex flex-wrap gap-2">
        <li
          v-for="a in grouped[kind]"
          :key="a.id"
          class="inline-flex items-center gap-1 rounded-full bg-bg/60 px-3 py-1 text-sm"
          :class="kind === 'no_go' ? 'line-through text-muted' : ''"
        >
          <span>{{ a.firstName }} {{ a.lastName }}</span>
          <span v-if="a.plusOne" class="text-accent" title="+1 / partner">+1</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">—</p>
    </div>
  </section>
</template>
