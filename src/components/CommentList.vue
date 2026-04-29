<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useFeedStore } from '@/stores/feed';
import { useSessionStore } from '@/stores/session';
import { useTimeAgo } from '@/composables/useTimeAgo';
import EmojiReactionBar from './EmojiReactionBar.vue';

const props = defineProps<{ postId: string; readonly?: boolean }>();

const feed = useFeedStore();
const session = useSessionStore();
const draft = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const deletingId = ref<string | null>(null);

const comments = computed(() => feed.commentsByPost[props.postId] ?? []);

onMounted(async () => {
  if (!feed.commentsByPost[props.postId]) {
    await feed.loadComments(props.postId);
  }
});

async function submit(): Promise<void> {
  const body = draft.value.trim();
  if (!body) return;
  submitting.value = true;
  error.value = null;
  try {
    await feed.createComment(props.postId, body);
    draft.value = '';
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    submitting.value = false;
  }
}

async function reactEmoji(commentId: string, emoji: string): Promise<void> {
  if (props.readonly) return;
  try {
    await feed.reactCommentEmoji(props.postId, commentId, emoji);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

async function deleteComment(commentId: string): Promise<void> {
  if (deletingId.value) return;
  if (!window.confirm('Delete this comment?')) return;
  deletingId.value = commentId;
  error.value = null;
  try {
    await feed.deleteComment(props.postId, commentId);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    deletingId.value = null;
  }
}
</script>

<template>
  <div class="space-y-3 pt-3 border-t border-muted/20">
    <ul v-if="comments.length" class="space-y-2">
      <li v-for="c in comments" :key="c.id" class="text-sm flex items-start gap-2">
        <div class="flex-1 min-w-0">
          <span class="font-medium">
            <span aria-hidden="true" class="mr-1">{{ c.author.emoji }}</span>{{ c.author.firstName }} {{ c.author.lastName }}
          </span>
          <span class="text-muted text-xs ml-2">{{ useTimeAgo(c.createdAt).value }}</span>
          <p class="mt-0.5 whitespace-pre-wrap">{{ c.body }}</p>
          <EmojiReactionBar
            class="mt-1"
            size="sm"
            :emoji-counts="c.emojiCounts"
            :my-emojis="c.myEmojis"
            :readonly="readonly"
            @react="(e: string) => reactEmoji(c.id, e)"
          />
        </div>
        <button
          v-if="session.isAdmin"
          type="button"
          class="text-xs text-danger hover:underline disabled:opacity-50 shrink-0"
          :disabled="deletingId === c.id"
          :title="'Delete comment (admin)'"
          @click="deleteComment(c.id)"
        >
          🗑️
        </button>
      </li>
    </ul>
    <p v-else class="text-sm text-muted">No comments yet.</p>

    <form v-if="!readonly" class="flex gap-2" @submit.prevent="submit">
      <input
        v-model="draft"
        class="input flex-1"
        type="text"
        maxlength="1000"
        placeholder="Add a comment…"
        :disabled="submitting"
      />
      <button class="btn" :disabled="submitting || !draft.trim()">Send</button>
    </form>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
  </div>
</template>
