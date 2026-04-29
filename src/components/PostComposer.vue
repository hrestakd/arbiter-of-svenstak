<script setup lang="ts">
import { ref } from 'vue';
import { useFeedStore } from '@/stores/feed';

const props = defineProps<{ eventId: string }>();
const feed = useFeedStore();

const draft = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const fileInput = ref<HTMLInputElement | null>(null);
const imageUrl = ref<string | null>(null);
const imageName = ref<string | null>(null);
const uploading = ref(false);

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';
const MAX_BYTES = 4 * 1024 * 1024;

function pickFile(): void {
  fileInput.value?.click();
}

async function onFileChange(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (!file) return;
  if (file.size > MAX_BYTES) {
    error.value = 'Image is larger than 4 MB.';
    return;
  }
  uploading.value = true;
  error.value = null;
  const url = `/api/admin/upload?prefix=posts/${encodeURIComponent(props.eventId)}`;
  const buffer = await file.arrayBuffer();
  const fileType = file.type || 'application/octet-stream';
  console.log('[upload] POST', url, {
    name: file.name,
    type: fileType,
    bytes: buffer.byteLength,
  });
  try {
    // Send as application/octet-stream — that's the only binary content type
    // @vercel/node's body parser handles natively (returns the Buffer
    // directly on req.body). Anything else falls back to a stream-replay
    // path that can stall mid-upload in vercel dev.
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Type': fileType,
      },
      body: buffer,
    });
    console.log('[upload] response', res.status, res.statusText);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      let msg = `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as { message?: string; code?: string };
        if (j.message) msg = j.message;
      } catch {
        if (text) msg = text.slice(0, 200);
      }
      throw new Error(msg);
    }
    const json = (await res.json()) as { url: string };
    imageUrl.value = json.url;
    imageName.value = file.name;
  } catch (err) {
    console.error('[upload] failed', err);
    error.value = `Upload failed: ${(err as Error).message}`;
  } finally {
    uploading.value = false;
  }
}

function clearImage(): void {
  imageUrl.value = null;
  imageName.value = null;
}

async function submit(): Promise<void> {
  const body = draft.value.trim();
  if (!body && !imageUrl.value) return;
  // Body is required by the API even with an image, so default to a single
  // space → trimmed → still rejected. Use a placeholder when only an image
  // was attached.
  const finalBody = body || '📷';
  submitting.value = true;
  error.value = null;
  try {
    await feed.createPost(props.eventId, finalBody, imageUrl.value);
    draft.value = '';
    imageUrl.value = null;
    imageName.value = null;
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
      placeholder="A piši, nije da te možemo spriječit..."
      :disabled="submitting"
    />

    <div v-if="imageUrl" class="relative inline-block">
      <img :src="imageUrl" :alt="imageName ?? 'attached image'" class="max-h-48 rounded border border-muted/30" />
      <button
        type="button"
        class="absolute top-1 right-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white hover:bg-black/80"
        :disabled="submitting"
        @click="clearImage"
      >
        ✕
      </button>
    </div>

    <input
      ref="fileInput"
      type="file"
      class="hidden"
      :accept="ACCEPT"
      @change="onFileChange"
    />

    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-ghost text-sm"
          :disabled="submitting || uploading"
          @click="pickFile"
        >
          {{ uploading ? 'Uploading…' : imageUrl ? 'Replace image' : '📎 Add image' }}
        </button>
        <span class="text-xs text-muted">{{ draft.length }} / 2000</span>
      </div>
      <button
        class="btn"
        :disabled="submitting || uploading || (!draft.trim() && !imageUrl)"
      >
        Post
      </button>
    </div>

    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </form>
</template>
