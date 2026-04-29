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
    ? 'text-xs px-1.5 py-0.5 gap-1'
    : 'text-sm px-2 py-0.5 gap-1.5'
);
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-1">
    <button
      v-for="emoji in visibleReactions"
      :key="emoji"
      type="button"
      :disabled="readonly || submitting === emoji"
      :class="[
        'inline-flex items-center font-display border-2 transition-all duration-75 disabled:opacity-50',
        btnSize,
        mySet.has(emoji)
          ? 'bg-accent text-bg border-ink shadow-pixel-sm'
          : 'bg-surface text-muted border-ink/30 hover:text-ink hover:border-ink',
      ]"
      :title="mySet.has(emoji) ? 'Remove reaction' : 'Add reaction'"
      @click="toggle(emoji)"
    >
      <span aria-hidden="true">{{ emoji }}</span>
      <span class="text-[12px] font-mono">{{ emojiCounts[emoji] ?? 0 }}</span>
    </button>

    <div v-if="!readonly" class="relative inline-flex">
      <button
        type="button"
        :class="[
          'inline-flex items-center font-display border-2 transition-all duration-75',
          'bg-surface text-muted border-ink/30 hover:text-ink hover:border-ink',
          btnSize,
        ]"
        :aria-expanded="showPicker"
        title="Add reaction"
        @click="showPicker = !showPicker"
      >
        ＋
      </button>
      <div
        v-if="showPicker"
        class="absolute z-10 top-full right-0 mt-1 flex flex-wrap items-center gap-1 px-2 py-1 border-2 border-ink/40 bg-paper shadow-pixel-sm max-w-[16rem]"
      >
        <button
          v-for="emoji in REACTION_EMOJIS"
          :key="emoji"
          type="button"
          :disabled="submitting === emoji"
          :class="[
            'px-1 text-base hover:bg-accent/20 disabled:opacity-50',
            mySet.has(emoji) ? 'bg-accent/20' : '',
          ]"
          @click="toggle(emoji)"
        >
          {{ emoji }}
        </button>
      </div>
    </div>
  </div>
</template>
