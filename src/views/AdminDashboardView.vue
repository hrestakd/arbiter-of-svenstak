<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useEventStore } from '@/stores/event';
import { useSessionStore } from '@/stores/session';

const router = useRouter();
const eventStore = useEventStore();
const session = useSessionStore();

onMounted(async () => {
  await eventStore.loadArchive();
});

async function logout(): Promise<void> {
  await session.logoutAdmin();
  await router.push({ name: 'admin-login' });
}
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-3xl mx-auto space-y-5">
    <header class="flex items-baseline justify-between flex-wrap gap-3">
      <h1 class="text-3xl">Admin</h1>
      <div class="flex items-center gap-3 text-sm">
        <span class="text-muted">Signed in as <strong>{{ session.admin?.username }}</strong></span>
        <button class="btn-ghost" type="button" @click="logout">Sign out</button>
      </div>
    </header>

    <section class="space-y-3">
      <div class="flex items-baseline justify-between">
        <h2 class="text-xl">Events</h2>
        <RouterLink class="btn" :to="{ name: 'admin-event-new' }">+ New event</RouterLink>
      </div>

      <ul v-if="eventStore.archive.length" class="space-y-2">
        <li v-for="ev in eventStore.archive" :key="ev.id">
          <RouterLink
            :to="{ name: 'admin-event-edit', params: { id: ev.id } }"
            class="card block hover:opacity-90"
          >
            <div class="flex items-baseline justify-between">
              <span class="font-medium">{{ ev.title }}</span>
              <span class="text-sm text-muted">{{ ev.year }}</span>
            </div>
            <div class="text-sm text-muted">
              {{ new Date(ev.startsAt).toLocaleDateString() }}
              <span v-if="ev.theme"> · {{ ev.theme }}</span>
              <span v-if="ev.isCurrent" class="text-accent ml-2">· current</span>
            </div>
          </RouterLink>
        </li>
      </ul>
      <p v-else class="card text-center text-muted">No events yet — create the first one.</p>
    </section>
  </main>
</template>
