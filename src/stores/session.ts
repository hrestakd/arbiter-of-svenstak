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

export const useSessionStore = defineStore('session', () => {
  const attendee = ref<AttendeeSession | null>(null);
  const admin = ref<AdminSession | null>(null);
  const probed = ref(false);
  const probing = ref(false);

  const isAdmin = computed(() => admin.value !== null);
  const isAttendee = computed(() => attendee.value !== null);

  async function probe(): Promise<void> {
    if (probed.value || probing.value) return;
    probing.value = true;
    try {
      const me = await api.get<AdminSession>('/api/auth/me').catch((e: ApiError) => {
        if (e.status === 401) return null;
        throw e;
      });
      admin.value = me;
      // Attendee session lives in HttpOnly cookie; the only way to know it's
      // valid is to hit a protected endpoint. The Gate view will probe lazily
      // via the events/current → posts list flow on first navigate.
    } finally {
      probing.value = false;
      probed.value = true;
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
    probed,
    probing,
    isAdmin,
    isAttendee,
    probe,
    setAttendee,
    setAdmin,
    logoutAdmin,
  };
});
