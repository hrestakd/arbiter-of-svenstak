<script setup lang="ts">
import { computed, ref } from 'vue';
import { REACTION_EMOJIS } from '@/stores/feed';

const props = defineProps<{
  emojiCounts: Record<string, number>;
  myEmojis: string[];
  readonly?: boolean;
  size?: 'sm' | 'md';
}>();

const emit = defineEmits<{ (e: 'react', emoji: string): void }>();

const showPicker = ref(false);
const submitting = ref<string | null>(null);

const mySet = computed(() => new Set(props.myEmojis));

const visibleReactions = computed(() =>
  REACTION_EMOJIS.filter(
    (e) => (props.emojiCounts[e] ?? 0) > 0 || mySet.value.has(e)
  )
);

async function toggle(emoji: string): Promise<void> {
  if (props.readonly || submitting.value) return;
  submitting.value = emoji;
  try {
    emit('react', emoji);
  } finally {
    submitting.value = null;
    showPicker.value = false;
  }
}

const btnSize = computed(() =>
  props.size === 'sm'
    ? 'text-xs px-1.5 py-0.5'
    : 'text-sm px-2 py-0.5'
);
</script>

<template>
  <div class="flex flex-wrap items-center gap-1">
    <button
      v-for="emoji in visibleReactions"
      :key="emoji"
      type="button"
      :disabled="readonly || submitting === emoji"
      :class="[
        'rounded-full border transition disabled:opacity-50',
        btnSize,
        mySet.has(emoji)
          ? 'bg-accent/20 border-accent text-ink'
          : 'bg-transparent border-muted/30 text-muted hover:border-ink/50 hover:text-ink',
      ]"
      :title="mySet.has(emoji) ? 'Remove reaction' : 'Add reaction'"
      @click="toggle(emoji)"
    >
      <span class="mr-1">{{ emoji }}</span>
      <span class="font-mono">{{ emojiCounts[emoji] ?? 0 }}</span>
    </button>

    <button
      v-if="!readonly"
      type="button"
      :class="[
        'rounded-full border border-muted/30 text-muted hover:border-ink/50 hover:text-ink',
        btnSize,
      ]"
      :aria-expanded="showPicker"
      title="Add reaction"
      @click="showPicker = !showPicker"
    >
      ＋
    </button>

    <div
      v-if="showPicker && !readonly"
      class="flex flex-wrap items-center gap-1 ml-1 px-1 py-0.5 rounded border border-muted/30 bg-paper"
    >
      <button
        v-for="emoji in REACTION_EMOJIS"
        :key="emoji"
        type="button"
        :disabled="submitting === emoji"
        :class="[
          'rounded hover:bg-accent/20 disabled:opacity-50 px-1',
          mySet.has(emoji) ? 'bg-accent/10' : '',
        ]"
        @click="toggle(emoji)"
      >
        {{ emoji }}
      </button>
    </div>
  </div>
</template>
