<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { upload } from '@vercel/blob/client';
import type { EventDetail, PaymentTag } from '@/stores/event';

const props = defineProps<{
  initial?: EventDetail | null;
  mode: 'new' | 'edit';
}>();

const emit = defineEmits<{
  (e: 'submit', value: FormPayload): void;
  (e: 'delete'): void;
}>();

export interface FormPayload {
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

const THEME_OPTIONS = ['classic', 'neon'];

const form = reactive<FormPayload>({
  year: new Date().getFullYear(),
  title: '',
  theme: 'classic',
  description: '',
  location: '',
  startsAt: '',
  headerImageUrl: null,
  paymentTags: [
    { label: 'Revolut · Domagoj', value: '' },
    { label: 'Revolut · Sven', value: '' },
    { label: 'KeksPay · Domagoj', value: '' },
    { label: 'KeksPay · Sven', value: '' },
  ],
  isCurrent: true,
});

const submitting = ref(false);
const uploading = ref(false);
const uploadError = ref<string | null>(null);

watch(
  () => props.initial,
  (e) => {
    if (!e) return;
    form.year = e.year;
    form.title = e.title;
    form.theme = e.theme ?? 'classic';
    form.description = e.description;
    form.location = e.location;
    form.startsAt = toLocalInput(e.startsAt);
    form.headerImageUrl = e.headerImageUrl;
    form.paymentTags = (e.paymentTags ?? []).map((t) => ({ ...t }));
    form.isCurrent = e.isCurrent;
  },
  { immediate: true }
);

const canSubmit = computed(
  () => form.title.trim().length > 0 && form.startsAt.length > 0 && Number.isInteger(form.year)
);

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string {
  return new Date(local).toISOString();
}

function addTag(): void {
  form.paymentTags.push({ label: '', value: '' });
}
function removeTag(idx: number): void {
  form.paymentTags.splice(idx, 1);
}

async function onPickFile(ev: Event): Promise<void> {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  uploading.value = true;
  uploadError.value = null;
  try {
    const blob = await upload(`events/${form.year}/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/admin/upload',
    });
    form.headerImageUrl = blob.url;
  } catch (e) {
    uploadError.value = (e as Error).message;
  } finally {
    uploading.value = false;
  }
}

function submit(): void {
  if (!canSubmit.value) return;
  submitting.value = true;
  emit('submit', {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
    location: form.location.trim(),
    theme: form.theme?.trim() || null,
    startsAt: fromLocalInput(form.startsAt),
    paymentTags: form.paymentTags.filter((t) => t.label.trim() && t.value.trim()),
  });
  // Caller resets via prop change; release the spinner asynchronously.
  window.setTimeout(() => {
    submitting.value = false;
  }, 1500);
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="space-y-1">
        <span class="text-sm text-muted">Year</span>
        <input v-model.number="form.year" class="input" type="number" min="2000" max="2100" required />
      </label>
      <label class="space-y-1">
        <span class="text-sm text-muted">Date &amp; time</span>
        <input v-model="form.startsAt" class="input" type="datetime-local" required />
      </label>
    </div>

    <label class="space-y-1 block">
      <span class="text-sm text-muted">Title</span>
      <input v-model="form.title" class="input" type="text" maxlength="200" required />
    </label>

    <div class="grid sm:grid-cols-2 gap-3">
      <label class="space-y-1">
        <span class="text-sm text-muted">Theme</span>
        <select v-model="form.theme" class="input">
          <option v-for="t in THEME_OPTIONS" :key="t" :value="t">{{ t }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span class="text-sm text-muted">Location</span>
        <input v-model="form.location" class="input" type="text" maxlength="500" />
      </label>
    </div>

    <label class="space-y-1 block">
      <span class="text-sm text-muted">Description</span>
      <textarea v-model="form.description" class="input" rows="6" maxlength="10000" />
    </label>

    <fieldset class="space-y-2">
      <legend class="text-sm text-muted">Header image</legend>
      <div v-if="form.headerImageUrl" class="rounded-lg overflow-hidden border border-muted/30">
        <img :src="form.headerImageUrl" alt="" class="w-full aspect-[2/1] object-cover" />
      </div>
      <input type="file" accept="image/*" :disabled="uploading" @change="onPickFile" />
      <p v-if="uploading" class="text-sm text-muted">Uploading…</p>
      <p v-if="uploadError" class="text-sm text-danger">{{ uploadError }}</p>
    </fieldset>

    <fieldset class="space-y-2">
      <legend class="text-sm text-muted">Payment tags</legend>
      <div v-for="(tag, i) in form.paymentTags" :key="i" class="grid grid-cols-[1fr_1fr_auto] gap-2">
        <input v-model="tag.label" class="input" placeholder="Label (e.g. Revolut · Domagoj)" maxlength="80" />
        <input v-model="tag.value" class="input" placeholder="Handle (e.g. @domagoj)" maxlength="120" />
        <button type="button" class="btn-ghost" @click="removeTag(i)" aria-label="Remove tag">×</button>
      </div>
      <button type="button" class="btn-ghost" @click="addTag">+ Add tag</button>
    </fieldset>

    <label class="flex items-center gap-2">
      <input v-model="form.isCurrent" type="checkbox" class="accent-accent" />
      <span class="text-sm">Mark as the current event</span>
    </label>

    <div class="flex items-center gap-2">
      <button class="btn" :disabled="!canSubmit || submitting">
        {{ mode === 'new' ? 'Create event' : 'Save changes' }}
      </button>
      <button
        v-if="mode === 'edit'"
        type="button"
        class="btn-ghost text-danger ml-auto"
        @click="emit('delete')"
      >
        Delete
      </button>
    </div>
  </form>
</template>
