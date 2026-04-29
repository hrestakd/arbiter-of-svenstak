<script setup lang="ts">
import { computed, ref } from 'vue';
import { useFeedStore, type Post, REACTION_EMOJIS } from '@/stores/feed';
import { useSessionStore } from '@/stores/session';
import { useTimeAgo } from '@/composables/useTimeAgo';
import ReactionButton from './ReactionButton.vue';
import CommentList from './CommentList.vue';
import EmojiReactionBar from './EmojiReactionBar.vue';

const props = defineProps<{ post: Post; readonly?: boolean }>();
const feed = useFeedStore();
const session = useSessionStore();

const showComments = ref(false);
const showPicker = ref(false);
const deleting = ref(false);

const mySet = computed(() => new Set(props.post.myEmojis));

async function react(kind: 'like' | 'dislike'): Promise<void> {
  if (props.readonly) return;
  await feed.react(props.post, kind);
}

async function reactEmoji(emoji: string): Promise<void> {
  if (props.readonly) return;
  await feed.reactPostEmoji(props.post.id, emoji);
}

async function pickEmoji(emoji: string): Promise<void> {
  await reactEmoji(emoji);
  showPicker.value = false;
}

async function deletePost(): Promise<void> {
  if (deleting.value) return;
  if (!window.confirm('Delete this post? This cannot be undone.')) return;
  deleting.value = true;
  try {
    await feed.deletePost(props.post.eventId, props.post.id);
  } catch (e) {
    window.alert(`Delete failed: ${(e as Error).message}`);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <article class="card space-y-3">
    <header class="flex items-baseline justify-between">
      <span class="font-semibold">
        <span aria-hidden="true" class="mr-1">{{ post.author.emoji }}</span>{{ post.author.firstName }} {{ post.author.lastName }}
      </span>
      <span class="flex items-center gap-2">
        <span class="text-sm text-muted">{{ useTimeAgo(post.createdAt).value }}</span>
        <button
          v-if="session.isAdmin"
          type="button"
          class="text-xs text-danger hover:underline disabled:opacity-50"
          :disabled="deleting"
          :title="'Delete post (admin)'"
          @click="deletePost"
        >
          🗑️
        </button>
      </span>
    </header>
    <p class="whitespace-pre-wrap">{{ post.body }}</p>
    <a
      v-if="post.imageUrl"
      :href="post.imageUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="block"
    >
      <img
        :src="post.imageUrl"
        alt=""
        loading="lazy"
        class="max-h-96 w-auto rounded border border-muted/20"
      />
    </a>
    <footer class="flex items-center gap-2 relative">
      <ReactionButton icon="👍" label="Like" :count="post.likeCount" @click="react('like')" />
      <ReactionButton icon="👎" label="Dislike" :count="post.dislikeCount" @click="react('dislike')" />
      <button
        v-if="!readonly"
        type="button"
        class="rounded-full border border-muted/30 text-muted hover:border-ink/50 hover:text-ink text-sm px-2 py-0.5"
        :aria-expanded="showPicker"
        title="Add reaction"
        @click="showPicker = !showPicker"
      >
        ＋
      </button>

      <div
        v-if="showPicker && !readonly"
        class="absolute left-0 top-full mt-1 z-10 flex flex-wrap items-center gap-1 px-1 py-0.5 rounded border border-muted/30 bg-paper shadow"
      >
        <button
          v-for="emoji in REACTION_EMOJIS"
          :key="emoji"
          type="button"
          :class="[
            'rounded hover:bg-accent/20 px-1',
            mySet.has(emoji) ? 'bg-accent/10' : '',
          ]"
          @click="pickEmoji(emoji)"
        >
          {{ emoji }}
        </button>
      </div>

      <button
        type="button"
        class="ml-auto text-sm text-muted hover:text-ink"
        @click="showComments = !showComments"
      >
        💬 {{ post.commentCount }} {{ post.commentCount === 1 ? 'comment' : 'comments' }}
      </button>
    </footer>
    <EmojiReactionBar
      hide-picker
      :emoji-counts="post.emojiCounts"
      :my-emojis="post.myEmojis"
      :readonly="readonly"
      @react="reactEmoji"
    />
    <CommentList v-if="showComments" :post-id="post.id" :readonly="readonly" />
  </article>
</template>
