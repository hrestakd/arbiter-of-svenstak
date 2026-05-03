<script setup lang="ts">
import { computed } from 'vue';
import { useEventStore } from '@/stores/event';

const props = defineProps<{ eventId: string; readonly?: boolean }>();
const store = useEventStore();

type Choice = 'eat_drink' | 'drink' | 'eat';

const OPTIONS: { value: Choice; label: string }[] = [
  { value: 'eat_drink', label: 'Jedem i Pijem' },
  { value: 'drink', label: 'Samo Pijem' },
  { value: 'eat', label: 'Samo Jedem' },
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
      <h2 class="text-xl">Poll za hranu</h2>
      <span class="text-sm text-muted">{{ total }} vote{{ total === 1 ? '' : 's' }}</span>
    </header>

    <ul class="space-y-2">
      <li v-for="opt in OPTIONS" :key="opt.value">
        <button
          type="button"
          class="w-full text-left border-2 border-ink/40 px-3 py-2 transition-all duration-75 disabled:cursor-not-allowed"
          :class="store.poll.mine === opt.value
            ? 'border-accent bg-accent/15 shadow-pixel-sm'
            : 'hover:border-ink hover:bg-accent-2/10'"
          :disabled="readonly"
          @click="vote(opt.value)"
        >
          <div class="flex items-baseline justify-between gap-2">
            <span class="font-display text-[10px] uppercase tracking-wider">{{ opt.label }}</span>
            <span class="text-sm text-muted font-body">
              {{ store.poll.counts[opt.value] }} · {{ pct(store.poll.counts[opt.value]) }}%
            </span>
          </div>
          <div class="mt-2 h-2 bg-bg border border-ink/40 overflow-hidden">
            <div
              class="h-full bg-accent transition-all"
              :style="{ width: `${pct(store.poll.counts[opt.value])}%` }"
            />
          </div>
        </button>
      </li>
    </ul>
    <p v-if="!store.poll.mine && !readonly" class="text-xs text-muted">Ako si vege javi se posebno</p>
  </section>
</template>
