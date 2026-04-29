<script setup lang="ts">
import type { PaymentTag } from '@/stores/event';

defineProps<{ tags: PaymentTag[] }>();

async function copy(value: string, ev: Event): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    const btn = ev.currentTarget as HTMLButtonElement;
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    window.setTimeout(() => {
      btn.textContent = original;
    }, 1200);
  } catch {
    // Clipboard blocked — silent.
  }
}
</script>

<template>
  <aside v-if="tags.length" class="card space-y-3">
    <header class="space-y-0.5">
      <h2 class="text-lg">Pitch in</h2>
      <p class="text-xs text-muted">Revolut · KeksPay</p>
    </header>

    <ul class="space-y-2">
      <li
        v-for="(tag, i) in tags"
        :key="i"
        class="flex items-center justify-between gap-2 border-2 border-ink/30 px-2.5 py-1.5"
      >
        <div class="min-w-0">
          <div class="text-xs text-muted truncate">{{ tag.label }}</div>
          <div class="font-mono text-sm truncate">{{ tag.value }}</div>
        </div>
        <button
          class="btn-ghost text-xs shrink-0"
          type="button"
          @click="copy(tag.value, $event)"
        >
          Copy
        </button>
      </li>
    </ul>
  </aside>
</template>
