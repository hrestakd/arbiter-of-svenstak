/**
 * Session store. Tracks both the attendee "soft session" and the admin
 * GitHub-OAuth session. The probe() method is called once on app boot
 * from App.vue and asks the server who we are.
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/composables/useApi';
import type { ApiError } from '@/composables/useApi';

export type Attendance = 'attending' | 'maybe' | 'no_go';

export interface AttendeeSession {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  attendance: Attendance;
  plusOne: boolean;
}

export interface AdminSession {
  username: string;
}

const GUEST_KEY = 'guest_mode';

function loadGuestMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(GUEST_KEY) === '1';
}

export const useSessionStore = defineStore('session', () => {
  const attendee = ref<AttendeeSession | null>(null);
  const admin = ref<AdminSession | null>(null);
  const guestMode = ref(loadGuestMode());
  const probed = ref(false);
  const probing = ref(false);

  const isAdmin = computed(() => admin.value !== null);
  const isAttendee = computed(() => attendee.value !== null);
  // Either signed-in attendee or self-declared guest can view event pages.
  const canView = computed(() => isAttendee.value || guestMode.value);
  // Only real attendees can post / vote / react / comment.
  const canWrite = computed(() => isAttendee.value);

  async function probe(): Promise<void> {
    if (probed.value || probing.value) return;
    probing.value = true;
    try {
      const me = await api
        .get<{
          admin: { username: string } | null;
          attendee: AttendeeSession | null;
        }>('/api/auth/me')
        .catch((e: ApiError) => {
          // Network or unexpected error — don't crash the boot, just leave
          // both sessions null so guards send the user to the gate.
          console.warn('[session] probe failed', e.status, e.code);
          return { admin: null, attendee: null };
        });
      admin.value = me.admin;
      attendee.value = me.attendee;
      // Drop a stale guest flag if we now have a real session (attendee or
      // admin). The flag was useful when cookies were broken, but persists in
      // localStorage forever otherwise and confuses canView semantics.
      if ((me.attendee || me.admin) && guestMode.value) {
        exitGuestMode();
      }
    } finally {
      probing.value = false;
      probed.value = true;
    }
  }

  function enterGuestMode(): void {
    guestMode.value = true;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(GUEST_KEY, '1');
    }
  }

  function exitGuestMode(): void {
    guestMode.value = false;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(GUEST_KEY);
    }
  }

  function setAttendee(a: AttendeeSession | null): void {
    attendee.value = a;
  }

  function setAdmin(a: AdminSession | null): void {
    admin.value = a;
  }

  async function logoutAdmin(): Promise<void> {
    await api.post('/api/auth/logout');
    admin.value = null;
  }

  return {
    attendee,
    admin,
    guestMode,
    probed,
    probing,
    isAdmin,
    isAttendee,
    canView,
    canWrite,
    probe,
    setAttendee,
    setAdmin,
    logoutAdmin,
    enterGuestMode,
    exitGuestMode,
  };
});
