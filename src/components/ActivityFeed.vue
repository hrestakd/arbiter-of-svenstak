<script setup lang="ts">
import { onMounted } from 'vue';
import { useFeedStore } from '@/stores/feed';
import PostCard from './PostCard.vue';
import PostComposer from './PostComposer.vue';

const props = defineProps<{ eventId: string; readonly?: boolean }>();
const feed = useFeedStore();

onMounted(async () => {
  feed.reset();
  await feed.loadFirstPage(props.eventId);
});

async function loadMore(): Promise<void> {
  await feed.loadMore(props.eventId);
}
</script>

<template>
  <section class="space-y-4">
    <PostComposer v-if="!readonly" :event-id="eventId" />

    <div v-if="!feed.posts.length && !feed.loading" class="card text-center text-muted">
      No posts yet — be the first.
    </div>

    <PostCard v-for="post in feed.posts" :key="post.id" :post="post" :readonly="readonly" />

    <button
      v-if="feed.nextCursor"
      class="btn-ghost w-full"
      :disabled="feed.loading"
      @click="loadMore"
    >
      {{ feed.loading ? 'Loading…' : 'Load more' }}
    </button>
  </section>
</template>
