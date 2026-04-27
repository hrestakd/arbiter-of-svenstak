<script setup lang="ts">
/**
 * The main event page. Used in two modes:
 *   - default: current event, full read/write
 *   - archive: pass `archiveYear` prop, read-only, no realtime
 */

import { computed, onMounted, ref, watch } from 'vue';
import { useEventStore } from '@/stores/event';
import { useRealtime } from '@/composables/useRealtime';
import AttendeeList from '@/components/AttendeeList.vue';
import MealPoll from '@/components/MealPoll.vue';
import ActivityFeed from '@/components/ActivityFeed.vue';

const props = defineProps<{ archiveYear?: number }>();
const store = useEventStore();

const loading = ref(true);
const error = ref<string | null>(null);

const isArchive = computed(() => props.archiveYear !== undefined);
const eventId = computed(() => store.event?.id ?? null);

async function loadAll(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const e = props.archiveYear !== undefined
      ? await store.loadEventByYear(props.archiveYear)
      : await store.loadCurrent();
    if (!e) {
      error.value = isArchive.value ? 'No event for that year.' : 'No event has been published yet.';
      return;
    }
    await Promise.all([store.loadAttendees(e.id), store.loadPoll(e.id)]);
    if (!isArchive.value) {
      // Subscribe to realtime only for the live event.
      useRealtime(e.id);
    }
  } catch (e2) {
    error.value = (e2 as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(loadAll);
watch(() => props.archiveYear, loadAll);

const formattedDate = computed(() => {
  if (!store.event) return '';
  return new Date(store.event.startsAt).toLocaleString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-5">
    <p v-if="loading" class="text-center text-muted">Loading…</p>
    <p v-else-if="error" class="card text-center text-danger">{{ error }}</p>

    <template v-else-if="store.event && eventId">
      <article class="card overflow-hidden p-0">
        <img
          v-if="store.event.headerImageUrl"
          :src="store.event.headerImageUrl"
          :alt="store.event.title"
          class="w-full aspect-[2/1] object-cover"
        />
        <div class="p-5 space-y-2">
          <div class="flex items-baseline justify-between gap-2 flex-wrap">
            <h1 class="text-3xl">{{ store.event.title }}</h1>
            <span v-if="store.event.theme" class="text-sm text-accent">{{ store.event.theme }}</span>
          </div>
          <p class="text-muted">
            {{ formattedDate }}<span v-if="store.event.location"> · {{ store.event.location }}</span>
          </p>
          <p v-if="store.event.description" class="whitespace-pre-wrap pt-2">
            {{ store.event.description }}
          </p>
          <p v-if="isArchive" class="text-sm text-muted pt-2">Archive view — read only.</p>
        </div>
        <div
          v-if="store.event.locationMapUrl"
          class="border-t border-muted/20"
        >
          <iframe
            :src="store.event.locationMapUrl"
            class="w-full aspect-[16/9] block"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
            allowfullscreen
            :title="`Map: ${store.event.location || store.event.title}`"
          />
        </div>
      </article>

      <AttendeeList :attendees="store.attendees" />
      <MealPoll :event-id="eventId" :readonly="isArchive" />
      <ActivityFeed :event-id="eventId" :readonly="isArchive" />

      <div class="text-center pt-4">
        <RouterLink to="/archive" class="text-sm text-muted hover:text-ink">
          Browse past years →
        </RouterLink>
      </div>
    </template>
  </main>
</template>
