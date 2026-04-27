/**
 * Vue Router config + navigation guards.
 *
 * Two guard layers:
 *   - admin routes: require an admin session (probed by useSessionStore)
 *   - attendee routes: require an attendee_session cookie. We probe lazily
 *     by trying /api/events/current → list attendees; if that 401s the user
 *     is bounced back to /.
 */

import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useEventStore } from '@/stores/event';
import { api } from '@/composables/useApi';
import type { ApiError } from '@/composables/useApi';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'gate',
    component: () => import('@/views/GateView.vue'),
    meta: { title: 'Welcome' },
  },
  {
    path: '/payment-tags',
    name: 'payment-tags',
    component: () => import('@/views/PaymentTagsView.vue'),
    meta: { title: 'Payment Tags', requiresAttendee: true },
  },
  {
    path: '/event',
    name: 'event',
    component: () => import('@/views/EventView.vue'),
    meta: { title: 'Event', requiresAttendee: true },
  },
  {
    path: '/archive',
    name: 'archive',
    component: () => import('@/views/ArchiveListView.vue'),
    meta: { title: 'Archive', requiresAttendee: true },
  },
  {
    path: '/archive/:year(\\d+)',
    name: 'archive-year',
    component: () => import('@/views/EventView.vue'),
    props: (route) => ({ archiveYear: Number(route.params.year) }),
    meta: { title: 'Archive', requiresAttendee: true },
  },
  {
    // Backwards-compatible redirect; the page is gone but old bookmarks still
    // resolve. Sign-in now happens via the floating GitHub badge.
    path: '/admin/login',
    redirect: '/admin',
  },
  {
    path: '/admin',
    name: 'admin-dashboard',
    component: () => import('@/views/AdminDashboardView.vue'),
    meta: { title: 'Admin', requiresAdmin: true },
  },
  {
    path: '/admin/event/new',
    name: 'admin-event-new',
    component: () => import('@/views/AdminEventEditView.vue'),
    meta: { title: 'New Event', requiresAdmin: true },
    props: { mode: 'new' },
  },
  {
    path: '/admin/event/:id/edit',
    name: 'admin-event-edit',
    component: () => import('@/views/AdminEventEditView.vue'),
    meta: { title: 'Edit Event', requiresAdmin: true },
    props: (route) => ({ mode: 'edit', eventId: route.params.id }),
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

// Track whether we've ever successfully confirmed the attendee cookie.
// Once confirmed for the session, we skip the per-navigation probe.
let attendeeConfirmed = false;

async function confirmAttendee(): Promise<boolean> {
  if (attendeeConfirmed) return true;
  const eventStore = useEventStore();
  const session = useSessionStore();
  try {
    const event = eventStore.event ?? (await eventStore.loadCurrent());
    if (!event) return false;
    // Probe by hitting an attendee-only endpoint.
    await api.get(`/api/events/${event.id}/attendees`);
    attendeeConfirmed = true;
    if (!session.attendee) {
      // We have a valid cookie but no in-memory session shape; fall back to
      // marking the session as "present, identity unknown until reload".
      session.setAttendee({
        id: 'unknown',
        eventId: event.id,
        firstName: '',
        lastName: '',
        attendance: 'attending',
        plusOne: false,
      });
    }
    return true;
  } catch (err) {
    if ((err as ApiError).status === 401) return false;
    throw err;
  }
}

router.beforeEach(async (to: RouteLocationNormalized, _from, next: NavigationGuardNext) => {
  const session = useSessionStore();
  if (!session.probed) await session.probe();

  if (to.meta.requiresAdmin && !session.isAdmin) {
    // Sign-in is now the floating GitHub badge, visible everywhere — bounce
    // home so the user can find it.
    return next('/');
  }

  if (to.meta.requiresAttendee) {
    const ok = await confirmAttendee();
    if (!ok) return next({ name: 'gate' });
  }

  if (to.name === 'gate' && session.isAttendee && attendeeConfirmed) {
    return next({ name: 'event' });
  }

  next();
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'Arbiter of Svenstak';
  document.title = `${title} · Arbiter of Svenstak`;
});

/** Called after a successful gate submission so subsequent navigations don't re-probe. */
export function markAttendeeConfirmed(): void {
  attendeeConfirmed = true;
}
