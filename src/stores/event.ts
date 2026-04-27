/**
 * Event store. Holds the currently-loaded event, its attendee list, and
 * the meal-poll counts.
 */

import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/composables/useApi';
import { useSessionStore, type Attendance } from './session';
import type { PollCounts } from '@/composables/useRealtime';

export interface PaymentTag {
  label: string;
  value: string;
}

export interface EventDetail {
  id: string;
  year: number;
  title: string;
  theme: string | null;
  description: string;
  location: string;
  startsAt: string;
  headerImageUrl: string | null;
  paymentTags: PaymentTag[];
  isCurrent: boolean;
}

export interface Attendee {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  attendance: Attendance;
  plusOne: boolean;
  createdAt: string;
}

export interface ArchiveItem {
  id: string;
  year: number;
  title: string;
  theme: string | null;
  startsAt: string;
  headerImageUrl: string | null;
  isCurrent: boolean;
}

export const useEventStore = defineStore('event', () => {
  const event = ref<EventDetail | null>(null);
  const attendees = ref<Attendee[]>([]);
  const poll = ref<{ counts: PollCounts; mine: 'eat_drink' | 'drink' | 'eat' | null }>({
    counts: { eat_drink: 0, drink: 0, eat: 0 },
    mine: null,
  });
  const archive = ref<ArchiveItem[]>([]);

  const grouped = computed(() => {
    const out: Record<Attendance, Attendee[]> = { attending: [], maybe: [], no_go: [] };
    for (const a of attendees.value) out[a.attendance].push(a);
    return out;
  });

  function setEvent(e: EventDetail | null): void {
    event.value = e;
    if (e) document.body.dataset.theme = (e.theme as string | null) ?? 'classic';
  }

  function upsertAttendee(a: Attendee): void {
    const idx = attendees.value.findIndex((x) => x.id === a.id);
    if (idx >= 0) attendees.value.splice(idx, 1, a);
    else attendees.value.push(a);
  }

  function setAttendees(list: Attendee[]): void {
    attendees.value = [...list];
  }

  function setPollCounts(c: PollCounts): void {
    poll.value = { ...poll.value, counts: c };
  }

  function setPoll(payload: PollCounts & { mine: 'eat_drink' | 'drink' | 'eat' | null }): void {
    poll.value = {
      counts: { eat_drink: payload.eat_drink, drink: payload.drink, eat: payload.eat },
      mine: payload.mine,
    };
  }

  async function loadCurrent(): Promise<EventDetail | null> {
    try {
      const e = await api.get<EventDetail>('/api/events/current');
      setEvent(e);
      return e;
    } catch {
      setEvent(null);
      return null;
    }
  }

  async function loadEventByYear(year: number): Promise<EventDetail | null> {
    const e = await api.get<EventDetail>(`/api/events/by-year/${year}`);
    setEvent(e);
    return e;
  }

  async function loadAttendees(eventId: string): Promise<void> {
    const list = await api.get<Attendee[]>(`/api/events/${eventId}/attendees`);
    setAttendees(list);
  }

  async function loadPoll(eventId: string): Promise<void> {
    const r = await api.get<PollCounts & { mine: 'eat_drink' | 'drink' | 'eat' | null }>(
      `/api/events/${eventId}/poll`
    );
    setPoll(r);
  }

  async function vote(eventId: string, choice: 'eat_drink' | 'drink' | 'eat'): Promise<void> {
    const r = await api.post<PollCounts & { mine: 'eat_drink' | 'drink' | 'eat' | null }>(
      `/api/events/${eventId}/poll`,
      { choice }
    );
    setPoll(r);
  }

  async function patchMyAttendance(payload: {
    attendance?: Attendance;
    plusOne?: boolean;
  }): Promise<void> {
    if (!event.value) return;
    const updated = await api.patch<Attendee>(
      `/api/events/${event.value.id}/attendees/me`,
      payload
    );
    upsertAttendee(updated);
    const session = useSessionStore();
    if (session.attendee && session.attendee.id === updated.id) {
      session.setAttendee({
        id: updated.id,
        eventId: updated.eventId,
        firstName: updated.firstName,
        lastName: updated.lastName,
        attendance: updated.attendance,
        plusOne: updated.plusOne,
      });
    }
  }

  async function loadArchive(): Promise<void> {
    archive.value = await api.get<ArchiveItem[]>('/api/events');
  }

  return {
    event,
    attendees,
    poll,
    archive,
    grouped,
    setEvent,
    setAttendees,
    upsertAttendee,
    setPollCounts,
    setPoll,
    loadCurrent,
    loadEventByYear,
    loadAttendees,
    loadPoll,
    vote,
    patchMyAttendance,
    loadArchive,
  };
});
