<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/composables/useApi';
import type { EventDetail } from '@/stores/event';
import AdminEventForm, { type FormPayload } from '@/components/AdminEventForm.vue';

const props = defineProps<{
  mode: 'new' | 'edit';
  eventId?: string;
}>();

const router = useRouter();
const initial = ref<EventDetail | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  if (props.mode === 'edit' && props.eventId) {
    loading.value = true;
    try {
      initial.value = await api.get<EventDetail>(`/api/events/${props.eventId}`);
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }
});

async function save(payload: FormPayload): Promise<void> {
  error.value = null;
  try {
    if (props.mode === 'new') {
      await api.post('/api/admin/events', payload);
    } else if (props.eventId) {
      await api.patch(`/api/admin/events/${props.eventId}`, payload);
    }
    await router.push({ name: 'admin-events' });
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function remove(): Promise<void> {
  if (!props.eventId) return;
  if (!window.confirm('Delete this event and all its posts/comments/votes?')) return;
  try {
    await api.del(`/api/admin/events/${props.eventId}`);
    await router.push({ name: 'admin-events' });
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <main class="min-h-screen p-4 sm:p-8 max-w-2xl mx-auto space-y-5">
    <header class="flex items-baseline justify-between">
      <h1 class="text-3xl">{{ mode === 'new' ? 'New event' : 'Edit event' }}</h1>
      <RouterLink class="text-sm text-muted hover:text-ink" :to="{ name: 'admin-events' }">
        ← Back
      </RouterLink>
    </header>

    <p v-if="loading" class="text-center text-muted">Loading…</p>
    <p v-else-if="error" class="card text-center text-danger">{{ error }}</p>

    <AdminEventForm
      v-else
      :mode="mode"
      :initial="initial"
      @submit="save"
      @delete="remove"
    />
  </main>
</template>
