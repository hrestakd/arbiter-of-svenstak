/**
 * Vue Router config + navigation guards.
 *
 * Two guard layers:
 *   - admin routes: require an admin session (populated by useSessionStore.probe)
 *   - attendee routes: require either a real attendee session or guest mode.
 *     Both are tracked client-side; the attendee one is populated from the
 *     /api/auth/me probe on app boot.
 */

import {
  createRouter,
  createWebHistory,
  type NavigationGuardNext,
  type RouteLocationNormalized,
  type RouteRecordRaw,
} from 'vue-router';
import { useSessionStore } from '@/stores/session';

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
    path: '/admin/events',
    name: 'admin-events',
    component: () => import('@/views/AdminEventsView.vue'),
    meta: { title: 'Events', requiresAdmin: true },
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

router.beforeEach(async (to: RouteLocationNormalized, _from, next: NavigationGuardNext) => {
  const session = useSessionStore();
  if (!session.probed) await session.probe();

  if (to.meta.requiresAdmin && !session.isAdmin) {
    // Sign-in is now the floating GitHub badge, visible everywhere — bounce
    // home so the user can find it.
    return next('/');
  }

  if (to.meta.requiresAttendee && !session.canView) {
    return next({ name: 'gate' });
  }

  // Skip the gate if the user is already in (real attendee or guest).
  if (to.name === 'gate' && session.canView) {
    return next({ name: 'event' });
  }

  next();
});

router.afterEach((to) => {
  const title = (to.meta.title as string | undefined) ?? 'Arbiter of Svenstak';
  document.title = `${title} · Arbiter of Svenstak`;
});
