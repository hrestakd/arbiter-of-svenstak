<script setup lang="ts">
defineProps<{
  count: number;
  active?: boolean;
  icon: string;
  label: string;
}>();

defineEmits<{ (e: 'click'): void }>();
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-colors"
    :class="active ? 'bg-accent/15 text-accent' : 'text-muted hover:bg-bg/50'"
    :aria-label="`${label} — ${count}`"
    @click="$emit('click')"
  >
    <span aria-hidden="true">{{ icon }}</span>
    <span>{{ count }}</span>
  </button>
</template>
