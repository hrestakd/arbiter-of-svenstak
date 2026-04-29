<script setup lang="ts">
/**
 * One-time interstitial after successful gate submission. Shows the Revolut
 * + KeksPay handles for both organizers, then routes to the event view.
 */

import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useEventStore } from '@/stores/event';

const router = useRouter();
const eventStore = useEventStore();
const tags = computed(() => eventStore.event?.paymentTags ?? []);

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

function continueToEvent(): void {
  void router.push({ name: 'event' });
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="card w-full max-w-md space-y-5">
      <header class="space-y-1 text-center">
        <h1 class="text-2xl">Aplauz!</h1>
        <p class="text-muted">
          Kotizacija je 5 EUR. Za razliku od inflacije, mi ne rastemo.
        </p>
      </header>

      <ul v-if="tags.length" class="space-y-2">
        <li
          v-for="(tag, i) in tags"
          :key="i"
          class="flex items-center justify-between border-2 border-ink/40 px-3 py-2"
        >
          <div>
            <div class="text-sm text-muted">{{ tag.label }}</div>
            <div class="font-mono">{{ tag.value }}</div>
          </div>
          <button class="btn-ghost text-sm" type="button" @click="copy(tag.value, $event)">
            Copy
          </button>
        </li>
      </ul>
      <p v-else class="text-sm text-muted text-center">(No payment tags configured yet.)</p>

      <button class="btn w-full" type="button" @click="continueToEvent">
        Idemo dalje →
      </button>
    </div>
  </main>
</template>
