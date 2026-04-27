<script setup lang="ts">
/**
 * Lets a signed-in attendee change their RSVP (attendance + plus-one) without
 * leaving the event page. Hits PATCH /api/events/:id/attendees/me, which
 * fans out an `attendee:updated` realtime event to other clients.
 */

import { computed, ref } from 'vue';
import { useEventStore } from '@/stores/event';
import { useSessionStore, type Attendance } from '@/stores/session';
import type { ApiError } from '@/composables/useApi';

const event = useEventStore();
const session = useSessionStore();

const ATTENDANCE_OPTIONS: { value: Attendance; label: string }[] = [
  { value: 'attending', label: 'Attending' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no_go', label: 'No-Go' },
];

const saving = ref<null | 'attendance' | 'plusOne'>(null);
const error = ref<string | null>(null);

const me = computed(() => session.attendee);
const canBringPlusOne = computed(() => me.value?.attendance !== 'no_go');

async function setAttendance(value: Attendance): Promise<void> {
  if (!me.value || me.value.attendance === value || saving.value) return;
  error.value = null;
  saving.value = 'attendance';
  try {
    // No-go attendees can't have a +1 — flip it off in the same call so the
    // user doesn't see a stale `+1` bubble next to their now-rejected RSVP.
    const payload: { attendance: Attendance; plusOne?: boolean } = { attendance: value };
    if (value === 'no_go' && me.value.plusOne) payload.plusOne = false;
    await event.patchMyAttendance(payload);
  } catch (e) {
    error.value = (e as ApiError).message ?? 'Failed to save.';
  } finally {
    saving.value = null;
  }
}

async function togglePlusOne(): Promise<void> {
  if (!me.value || saving.value) return;
  if (!canBringPlusOne.value) return;
  error.value = null;
  saving.value = 'plusOne';
  try {
    await event.patchMyAttendance({ plusOne: !me.value.plusOne });
  } catch (e) {
    error.value = (e as ApiError).message ?? 'Failed to save.';
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <section v-if="me" class="card space-y-3">
    <header class="flex items-baseline justify-between gap-2 flex-wrap">
      <h2 class="text-xl">Your RSVP</h2>
      <span class="text-sm text-muted">{{ me.firstName }} {{ me.lastName }}</span>
    </header>

    <fieldset class="space-y-2">
      <legend class="text-sm text-muted">Will you be there?</legend>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="opt in ATTENDANCE_OPTIONS"
          :key="opt.value"
          type="button"
          class="border-2 border-ink/40 px-3 py-2 text-sm transition-all duration-75 hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
          :class="me.attendance === opt.value ? 'border-accent bg-accent/15 shadow-pixel-sm' : ''"
          :disabled="saving !== null"
          :aria-pressed="me.attendance === opt.value"
          @click="setAttendance(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </fieldset>

    <fieldset class="space-y-2">
      <legend class="text-sm text-muted">Plus-one</legend>
      <button
        type="button"
        class="w-full border-2 border-ink/40 px-3 py-2 text-sm transition-all duration-75 hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed"
        :class="me.plusOne ? 'border-accent bg-accent/15 shadow-pixel-sm' : ''"
        :disabled="saving !== null || !canBringPlusOne"
        :aria-pressed="me.plusOne"
        @click="togglePlusOne"
      >
        <span v-if="me.plusOne">Bringing +1 — tap to remove</span>
        <span v-else-if="canBringPlusOne">Coming alone — tap to add +1</span>
        <span v-else class="text-muted">Ostavila te.</span>
      </button>
    </fieldset>

    <p v-if="saving" class="text-xs text-muted">Saving…</p>
    <p v-if="error" class="text-xs text-danger" role="alert">{{ error }}</p>
  </section>
</template>
