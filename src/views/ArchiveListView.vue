<script setup lang="ts">
/**
 * Archive list — every past event, newest first.
 */

import { onMounted, ref } from 'vue';
import { useEventStore } from '@/stores/event';

const store = useEventStore();
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    await store.loadArchive();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-5">
    <header class="text-center space-y-1">
      <h1 class="text-3xl">Past years</h1>
      <p class="text-muted">15 years and counting.</p>
    </header>

    <p v-if="loading" class="text-center text-muted">Loading…</p>
    <p v-else-if="error" class="card text-center text-danger">{{ error }}</p>

    <ul v-else-if="store.archive.length" class="grid gap-3 sm:grid-cols-2">
      <li v-for="ev in store.archive" :key="ev.id">
        <RouterLink
          :to="ev.isCurrent ? '/event' : `/archive/${ev.year}`"
          class="card block p-0 overflow-hidden hover:opacity-90 transition-opacity"
        >
          <div
            class="aspect-[2/1] bg-bg/40 flex items-center justify-center"
            :style="ev.headerImageUrl ? { backgroundImage: `url(${ev.headerImageUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}"
          >
            <span v-if="!ev.headerImageUrl" class="text-muted text-2xl">{{ ev.year }}</span>
          </div>
          <div class="p-4">
            <div class="flex items-baseline justify-between">
              <h2 class="text-xl">{{ ev.title }}</h2>
              <span class="text-sm text-muted">{{ ev.year }}</span>
            </div>
            <p v-if="ev.theme" class="text-sm text-accent">{{ ev.theme }}</p>
            <p v-if="ev.isCurrent" class="text-sm text-accent mt-1">↗ Current</p>
          </div>
        </RouterLink>
      </li>
    </ul>
    <p v-else class="card text-center text-muted">Nothing here yet.</p>

    <div class="text-center pt-4">
      <RouterLink to="/event" class="text-sm text-muted hover:text-ink">← Back to current event</RouterLink>
    </div>
  </main>
</template>
