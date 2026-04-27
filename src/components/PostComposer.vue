<script setup lang="ts">
import { ref } from 'vue';
import { useFeedStore } from '@/stores/feed';

const props = defineProps<{ eventId: string }>();
const feed = useFeedStore();

const draft = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

async function submit(): Promise<void> {
  const body = draft.value.trim();
  if (!body) return;
  submitting.value = true;
  error.value = null;
  try {
    await feed.createPost(props.eventId, body);
    draft.value = '';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="card space-y-2" @submit.prevent="submit">
    <textarea
      v-model="draft"
      class="input resize-none"
      rows="3"
      maxlength="2000"
      placeholder="What's on your mind?"
      :disabled="submitting"
    />
    <div class="flex items-center justify-between">
      <span class="text-xs text-muted">{{ draft.length }} / 2000</span>
      <button class="btn" :disabled="submitting || !draft.trim()">Post</button>
    </div>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </form>
</template>
