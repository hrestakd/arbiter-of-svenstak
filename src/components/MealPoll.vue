<script setup lang="ts">
import { computed } from 'vue';
import { useEventStore } from '@/stores/event';

const props = defineProps<{ eventId: string; readonly?: boolean }>();
const store = useEventStore();

type Choice = 'eat_drink' | 'drink' | 'eat';

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'eat_drink', label: 'Eating & Drinking' },
  { value: 'drink', label: 'Drinking only' },
  { value: 'eat', label: 'Eating only' },
];

const total = computed(() => {
  const c = store.poll.counts;
  return c.eat_drink + c.drink + c.eat;
});

function pct(n: number): number {
  if (total.value === 0) return 0;
  return Math.round((n / total.value) * 100);
}

async function vote(choice: Choice): Promise<void> {
  if (props.readonly) return;
  await store.vote(props.eventId, choice);
}
</script>

<template>
  <section class="card space-y-3">
    <header class="flex items-baseline justify-between">
      <h2 class="text-xl">What are we doing?</h2>
      <span class="text-sm text-muted">{{ total }} vote{{ total === 1 ? '' : 's' }}</span>
    </header>

    <ul class="space-y-2">
      <li v-for="opt in OPTIONS" :key="opt.value">
        <button
          type="button"
          class="w-full text-left rounded-lg border border-muted/30 px-3 py-2 transition-colors"
          :class="store.poll.mine === opt.value ? 'border-accent bg-accent/10' : 'hover:bg-bg/40'"
          :disabled="readonly"
          @click="vote(opt.value)"
        >
          <div class="flex items-baseline justify-between">
            <span class="font-medium">{{ opt.label }}</span>
            <span class="text-sm text-muted">
              {{ store.poll.counts[opt.value] }} · {{ pct(store.poll.counts[opt.value]) }}%
            </span>
          </div>
          <div class="mt-1 h-1 rounded bg-muted/20 overflow-hidden">
            <div
              class="h-full bg-accent transition-all"
              :style="{ width: `${pct(store.poll.counts[opt.value])}%` }"
            />
          </div>
        </button>
      </li>
    </ul>
    <p v-if="!store.poll.mine && !readonly" class="text-xs text-muted">Pick one — you can change it later.</p>
  </section>
</template>
