<script setup lang="ts">
import { ref } from 'vue';
import { useFeedStore, type Post } from '@/stores/feed';
import { useSessionStore } from '@/stores/session';
import { useTimeAgo } from '@/composables/useTimeAgo';
import ReactionButton from './ReactionButton.vue';
import CommentList from './CommentList.vue';
import EmojiReactionBar from './EmojiReactionBar.vue';

const props = defineProps<{ post: Post; readonly?: boolean }>();
const feed = useFeedStore();
const session = useSessionStore();

const showComments = ref(false);
const deleting = ref(false);

async function react(kind: 'like' | 'dislike'): Promise<void> {
  if (props.readonly) return;
  await feed.react(props.post, kind);
}

async function reactEmoji(emoji: string): Promise<void> {
  if (props.readonly) return;
  await feed.reactPostEmoji(props.post.id, emoji);
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
    <footer class="flex flex-wrap items-center gap-2">
      <ReactionButton icon="👍" label="Like" :count="post.likeCount" @click="react('like')" />
      <ReactionButton icon="👎" label="Dislike" :count="post.dislikeCount" @click="react('dislike')" />
      <EmojiReactionBar
        :emoji-counts="post.emojiCounts"
        :my-emojis="post.myEmojis"
        :readonly="readonly"
        @react="reactEmoji"
      />
      <button
        type="button"
        class="ml-auto text-sm text-muted hover:text-ink"
        @click="showComments = !showComments"
      >
        💬 {{ post.commentCount }} {{ post.commentCount === 1 ? 'comment' : 'comments' }}
      </button>
    </footer>
    <CommentList v-if="showComments" :post-id="post.id" :readonly="readonly" />
  </article>
</template>
