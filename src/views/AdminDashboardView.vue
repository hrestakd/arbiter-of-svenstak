<script setup lang="ts">
/**
 * Admin landing — explicit tile menu. Each tile is a route into a single
 * admin task. Keeps the surface tiny and obvious.
 */

import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const router = useRouter();
const session = useSessionStore();

async function logout(): Promise<void> {
  await session.logoutAdmin();
  await router.push('/');
}

interface Tile {
  to: { name: string };
  title: string;
  blurb: string;
  glyph: string;
}

const tiles: Tile[] = [
  {
    to: { name: 'admin-events' },
    title: 'Events',
    blurb: 'Browse and edit existing years.',
    glyph: '▦',
  },
  {
    to: { name: 'admin-event-new' },
    title: 'New event',
    blurb: 'Create a new year with image, date, location, theme.',
    glyph: '✦',
  },
];
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
    <header class="flex items-baseline justify-between flex-wrap gap-3">
      <div class="space-y-1">
        <h1 class="text-2xl">Admin Console</h1>
        <p class="text-sm text-muted font-body">
          Signed in as <strong>{{ session.admin?.username }}</strong>
        </p>
      </div>
      <button class="btn-ghost" type="button" @click="logout">Sign out</button>
    </header>

    <nav class="grid sm:grid-cols-2 gap-4">
      <RouterLink
        v-for="t in tiles"
        :key="t.title"
        :to="t.to"
        class="card flex flex-col gap-2 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
      >
        <div class="text-3xl text-accent font-display" aria-hidden="true">{{ t.glyph }}</div>
        <div class="font-display text-sm uppercase tracking-wider">{{ t.title }}</div>
        <p class="text-sm text-muted font-body">{{ t.blurb }}</p>
      </RouterLink>
    </nav>

    <footer class="text-center pt-4">
      <RouterLink to="/event" class="text-sm text-muted hover:text-ink font-body">
        ← Back to the public event
      </RouterLink>
    </footer>
  </main>
</template>
