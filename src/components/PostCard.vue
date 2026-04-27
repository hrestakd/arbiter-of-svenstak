<script setup lang="ts">
import { ref } from 'vue';
import { useFeedStore, type Post } from '@/stores/feed';
import { useTimeAgo } from '@/composables/useTimeAgo';
import ReactionButton from './ReactionButton.vue';
import CommentList from './CommentList.vue';

const props = defineProps<{ post: Post; readonly?: boolean }>();
const feed = useFeedStore();

const showComments = ref(false);

async function react(kind: 'like' | 'dislike'): Promise<void> {
  if (props.readonly) return;
  await feed.react(props.post, kind);
}
</script>

<template>
  <article class="card space-y-3">
    <header class="flex items-baseline justify-between">
      <span class="font-semibold">{{ post.author.firstName }} {{ post.author.lastName }}</span>
      <span class="text-sm text-muted">{{ useTimeAgo(post.createdAt).value }}</span>
    </header>
    <p class="whitespace-pre-wrap">{{ post.body }}</p>
    <footer class="flex items-center gap-2">
      <ReactionButton icon="👍" label="Like" :count="post.likeCount" @click="react('like')" />
      <ReactionButton icon="👎" label="Dislike" :count="post.dislikeCount" @click="react('dislike')" />
      <button
        type="button"
        class="ml-auto text-sm text-muted hover:text-ink"
        @click="showComments = !showComments"
      >
        💬 {{ post.commentCount }} {{ post.commentCount === 1 ? 'comment' : 'comments' }}
      </button>
    </footer>
    <CommentList v-if="showComments && !readonly" :post-id="post.id" />
  </article>
</template>
