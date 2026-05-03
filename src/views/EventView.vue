<script setup lang="ts">
/**
 * The main event page. Three modes:
 *   - attendee: full read/write
 *   - guest:    read-only, with a banner offering to RSVP
 *   - archive:  pass `archiveYear` prop, read-only, no realtime
 */

import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useEventStore } from '@/stores/event';
import { useSessionStore } from '@/stores/session';
import { useRealtime } from '@/composables/useRealtime';
import AttendeeList from '@/components/AttendeeList.vue';
import MealPoll from '@/components/MealPoll.vue';
import ActivityFeed from '@/components/ActivityFeed.vue';
import MyRsvp from '@/components/MyRsvp.vue';
import PaymentTagsCard from '@/components/PaymentTagsCard.vue';
import StabPeekers from '@/components/StabPeekers.vue';

const props = defineProps<{ archiveYear?: number }>();
const store = useEventStore();
const session = useSessionStore();
const router = useRouter();

const isReadOnly = computed(() => isArchive.value || !session.canWrite);
const showGuestBanner = computed(() => !isArchive.value && session.guestMode && !session.isAttendee);

function rsvpNow(): void {
  session.exitGuestMode();
  void router.push({ name: 'gate' });
}

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
  <div class="min-h-screen">
    <img
      v-if="store.event?.headerImageUrl && !isArchive"
      :src="store.event.headerImageUrl"
      :alt="store.event.title"
      class="w-full h-auto max-h-[70vh] object-contain block mx-auto"
    />

    <main class="p-4 sm:p-8 mx-auto space-y-5 max-w-5xl xl:max-w-[84rem]">
    <p v-if="loading" class="text-center text-muted">Loading…</p>
    <p v-else-if="error" class="card text-center text-danger">{{ error }}</p>

    <template v-else-if="store.event && eventId">
      <div
        v-if="showGuestBanner"
        class="card flex items-center justify-between gap-3 bg-accent/10 border-accent/30"
      >
        <p class="text-sm">
          Ti si lurker. Ako želiš ustati sa cuck-chaira, attendaj
        </p>
        <button class="btn-ghost text-sm" type="button" @click="rsvpNow">
          Attend →
        </button>
      </div>

      <div class="max-w-3xl mx-auto relative">
        <StabPeekers v-if="!isArchive" />
        <article class="card overflow-hidden p-0 relative z-10">
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
      </div>

      <div class="max-w-3xl mx-auto space-y-5">
        <div class="lg:flex lg:gap-5 lg:items-start space-y-5 lg:space-y-0">
          <MyRsvp
            v-if="!isArchive && session.isAttendee"
            class="lg:flex-1 lg:min-w-0"
          />
          <PaymentTagsCard
            :tags="store.event.paymentTags"
            class="lg:w-64 lg:shrink-0"
          />
        </div>

        <AttendeeList :attendees="store.attendees" />
        <MealPoll :event-id="eventId" :readonly="isReadOnly" />
        <ActivityFeed :event-id="eventId" :readonly="isReadOnly" />

        <div class="text-center pt-4">
          <RouterLink to="/archive" class="text-sm text-muted hover:text-ink">
            Arhiv Prijateljstva →
          </RouterLink>
        </div>
      </div>
    </template>
    </main>
  </div>
</template>
