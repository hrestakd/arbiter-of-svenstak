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
    class="inline-flex items-center gap-1.5 px-2 py-0.5 text-sm font-display border-2 transition-all duration-75"
    :class="active
      ? 'bg-accent text-bg border-ink shadow-pixel-sm'
      : 'bg-surface text-muted border-ink/30 hover:text-ink hover:border-ink'"
    :aria-label="`${label} — ${count}`"
    @click="$emit('click')"
  >
    <span aria-hidden="true">{{ icon }}</span>
    <span class="text-[12px]">{{ count }}</span>
  </button>
</template>
