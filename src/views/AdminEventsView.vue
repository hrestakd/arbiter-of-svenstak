<script setup lang="ts">
/**
 * Event list — the manage/edit half of admin. Click any row to open its
 * edit form.
 */

import { onMounted, ref } from 'vue';
import { useEventStore } from '@/stores/event';

const eventStore = useEventStore();
const loading = ref(true);

onMounted(async () => {
  try {
    await eventStore.loadArchive();
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-5">
    <header class="flex items-baseline justify-between flex-wrap gap-3">
      <div>
        <RouterLink class="text-xs text-muted hover:text-ink font-display uppercase tracking-wider" :to="{ name: 'admin-dashboard' }">
          ← Admin
        </RouterLink>
        <h1 class="text-2xl mt-2">Events</h1>
      </div>
      <RouterLink class="btn" :to="{ name: 'admin-event-new' }">+ New</RouterLink>
    </header>

    <div v-if="loading" class="space-y-2" aria-busy="true" aria-live="polite">
      <div
        v-for="i in 3"
        :key="i"
        class="card animate-pulse"
      >
        <div class="flex items-baseline justify-between">
          <span class="inline-block h-4 w-1/2 bg-muted/30" />
          <span class="inline-block h-3 w-12 bg-muted/20" />
        </div>
        <div class="mt-2 h-3 w-2/3 bg-muted/20" />
      </div>
      <p class="text-center text-xs text-muted font-display uppercase tracking-wider pt-1">
        Loading…
      </p>
    </div>

    <ul v-else-if="eventStore.archive.length" class="space-y-2">
      <li v-for="ev in eventStore.archive" :key="ev.id">
        <RouterLink
          :to="{ name: 'admin-event-edit', params: { id: ev.id } }"
          class="card block hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
        >
          <div class="flex items-baseline justify-between">
            <span class="font-display text-sm uppercase">{{ ev.title }}</span>
            <span class="text-sm text-muted font-body">{{ ev.year }}</span>
          </div>
          <div class="text-sm text-muted font-body mt-1">
            {{ new Date(ev.startsAt).toLocaleDateString() }}
            <span v-if="ev.theme"> · {{ ev.theme }}</span>
            <span v-if="ev.isCurrent" class="text-accent ml-2 font-display text-[10px]">· CURRENT</span>
          </div>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="card text-center text-muted">No events yet — create the first one.</p>
  </main>
</template>
