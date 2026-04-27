<script setup lang="ts">
/**
 * Gate view — the mandatory "soft login": first/last name + attendance + plus-one.
 * Submits to POST /api/events/:id/attendees, sets the attendee_session cookie,
 * then routes to /payment-tags.
 */

import { onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/composables/useApi';
import type { ApiError } from '@/composables/useApi';
import { useEventStore, type EventDetail } from '@/stores/event';
import { useSessionStore, type Attendance } from '@/stores/session';
import { markAttendeeConfirmed } from '@/router';

interface AttendeeResponse {
  attendee: {
    id: string;
    eventId: string;
    firstName: string;
    lastName: string;
    attendance: Attendance;
    plusOne: boolean;
  };
  event: EventDetail;
}

const router = useRouter();
const eventStore = useEventStore();
const session = useSessionStore();

const event = ref<EventDetail | null>(null);
const loading = ref(true);
const submitting = ref(false);
const error = ref<string | null>(null);

const form = reactive({
  firstName: '',
  lastName: '',
  attendance: 'attending' as Attendance,
  plusOne: false,
});

const ATTENDANCE_OPTIONS: { value: Attendance; label: string }[] = [
  { value: 'attending', label: 'Attending' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no_go', label: 'No-Go Traitor Scumbag' },
];

const PLUS_ONE_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: 'Coming alone' },
  { value: true, label: 'Bringing +1 (partner)' },
];

onMounted(async () => {
  loading.value = true;
  try {
    event.value = await eventStore.loadCurrent();
  } finally {
    loading.value = false;
  }
});

async function submit(): Promise<void> {
  if (!event.value) return;
  submitting.value = true;
  error.value = null;
  try {
    const r = await api.post<AttendeeResponse>(
      `/api/events/${event.value.id}/attendees`,
      {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        attendance: form.attendance,
        plusOne: form.plusOne,
      }
    );
    session.setAttendee(r.attendee);
    eventStore.setEvent(r.event);
    markAttendeeConfirmed();
    await router.push({ name: 'payment-tags' });
  } catch (e) {
    const err = e as ApiError;
    if (err.code === 'NAME_TAKEN') {
      error.value =
        'Someone has already signed up with that name. Pick a different spelling, or clear cookies on the device that already used it.';
    } else if (err.code === 'VALIDATION_ERROR') {
      error.value = 'Please fill in your first and last name.';
    } else {
      error.value = err.message;
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="card w-full max-w-md space-y-5">
      <header class="space-y-1 text-center">
        <h1 class="text-3xl">Arbiter of Svenstak</h1>
        <p v-if="event" class="text-muted">
          {{ event.title }} · {{ new Date(event.startsAt).toLocaleDateString() }}
        </p>
        <p v-else-if="loading" class="text-muted">Loading…</p>
        <p v-else class="text-muted">No event has been published yet.</p>
      </header>

      <form v-if="event" class="space-y-4" @submit.prevent="submit">
        <div class="grid grid-cols-2 gap-3">
          <label class="space-y-1">
            <span class="text-sm text-muted">First name</span>
            <input
              v-model="form.firstName"
              class="input"
              type="text"
              autocomplete="given-name"
              maxlength="60"
              required
            />
          </label>
          <label class="space-y-1">
            <span class="text-sm text-muted">Last name</span>
            <input
              v-model="form.lastName"
              class="input"
              type="text"
              autocomplete="family-name"
              maxlength="60"
              required
            />
          </label>
        </div>

        <fieldset class="space-y-2">
          <legend class="text-sm text-muted">Will you be there?</legend>
          <div class="grid gap-2">
            <label
              v-for="opt in ATTENDANCE_OPTIONS"
              :key="opt.value"
              class="flex items-center gap-2 rounded-lg border border-muted/30 px-3 py-2 cursor-pointer"
              :class="form.attendance === opt.value ? 'border-accent bg-accent/10' : ''"
            >
              <input v-model="form.attendance" type="radio" :value="opt.value" class="accent-accent" />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </fieldset>

        <fieldset class="space-y-2">
          <legend class="text-sm text-muted">Solo or +1?</legend>
          <div class="grid gap-2">
            <label
              v-for="opt in PLUS_ONE_OPTIONS"
              :key="String(opt.value)"
              class="flex items-center gap-2 rounded-lg border border-muted/30 px-3 py-2 cursor-pointer"
              :class="form.plusOne === opt.value ? 'border-accent bg-accent/10' : ''"
            >
              <input v-model="form.plusOne" type="radio" :value="opt.value" class="accent-accent" />
              <span>{{ opt.label }}</span>
            </label>
          </div>
        </fieldset>

        <button
          class="btn w-full"
          :disabled="submitting || !form.firstName.trim() || !form.lastName.trim()"
        >
          {{ submitting ? 'Submitting…' : 'Continue' }}
        </button>

        <p v-if="error" class="text-sm text-danger" role="alert">{{ error }}</p>
      </form>
    </div>
  </main>
</template>
