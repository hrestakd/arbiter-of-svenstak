/**
 * Feed store. Holds the activity-feed posts and their comments. Patched
 * incrementally by realtime events; backfilled by paginated API reads.
 */

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/composables/useApi';
import type { Attendance } from './session';

export interface Author {
  firstName: string;
  lastName: string;
  emoji: string;
}

export const REACTION_EMOJIS = ['❤️', '🔥', '🤣', '🎉', '😮', '😢', '👀', '🙏'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface Post {
  id: string;
  eventId: string;
  attendeeId: string;
  body: string;
  imageUrl: string | null;
  createdAt: string;
  author: Author;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  emojiCounts: Record<string, number>;
  myEmojis: string[];
}

export interface Comment {
  id: string;
  postId: string;
  attendeeId: string;
  body: string;
  createdAt: string;
  author: Author;
  emojiCounts: Record<string, number>;
  myEmojis: string[];
}

export interface Attendee {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  attendance: Attendance;
  plusOne: boolean;
  emoji: string;
  createdAt: string;
}

export const useFeedStore = defineStore('feed', () => {
  const posts = ref<Post[]>([]);
  const commentsByPost = ref<Record<string, Comment[]>>({});
  const nextCursor = ref<string | null>(null);
  const loading = ref(false);

  async function loadFirstPage(eventId: string): Promise<void> {
    loading.value = true;
    try {
      const r = await api.get<{ posts: Post[]; nextCursor: string | null }>(
        `/api/events/${eventId}/posts`
      );
      posts.value = r.posts;
      nextCursor.value = r.nextCursor;
    } finally {
      loading.value = false;
    }
  }

  async function loadMore(eventId: string): Promise<void> {
    if (!nextCursor.value || loading.value) return;
    loading.value = true;
    try {
      const r = await api.get<{ posts: Post[]; nextCursor: string | null }>(
        `/api/events/${eventId}/posts?cursor=${encodeURIComponent(nextCursor.value)}`
      );
      posts.value = [...posts.value, ...r.posts];
      nextCursor.value = r.nextCursor;
    } finally {
      loading.value = false;
    }
  }

  async function createPost(
    eventId: string,
    body: string,
    imageUrl: string | null = null
  ): Promise<Post> {
    const post = await api.post<Post>(`/api/events/${eventId}/posts`, {
      body,
      imageUrl,
    });
    // realtime fan-out usually arrives first; if not, prepend optimistically.
    if (!posts.value.find((p) => p.id === post.id)) {
      posts.value = [post, ...posts.value];
    }
    return post;
  }

  function prependPost(p: Post): void {
    if (posts.value.find((x) => x.id === p.id)) return;
    posts.value = [p, ...posts.value];
  }

  function patchReactions(postId: string, likeCount: number, dislikeCount: number): void {
    const idx = posts.value.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    posts.value.splice(idx, 1, {
      ...posts.value[idx],
      likeCount,
      dislikeCount,
    });
  }

  async function react(post: Post, kind: 'like' | 'dislike'): Promise<void> {
    const r = await api.post<{ likeCount: number; dislikeCount: number }>(
      `/api/posts/${post.id}/reactions`,
      { kind }
    );
    patchReactions(post.id, r.likeCount, r.dislikeCount);
  }

  function patchPostEmojiCounts(postId: string, emojiCounts: Record<string, number>): void {
    const idx = posts.value.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    posts.value.splice(idx, 1, { ...posts.value[idx], emojiCounts });
  }

  function patchPostMyEmojis(postId: string, myEmojis: string[]): void {
    const idx = posts.value.findIndex((p) => p.id === postId);
    if (idx < 0) return;
    posts.value.splice(idx, 1, { ...posts.value[idx], myEmojis });
  }

  function patchCommentEmojiCounts(
    postId: string,
    commentId: string,
    emojiCounts: Record<string, number>
  ): void {
    const list = commentsByPost.value[postId];
    if (!list) return;
    const idx = list.findIndex((c) => c.id === commentId);
    if (idx < 0) return;
    const updated = [...list];
    updated[idx] = { ...updated[idx], emojiCounts };
    commentsByPost.value = { ...commentsByPost.value, [postId]: updated };
  }

  function patchCommentMyEmojis(
    postId: string,
    commentId: string,
    myEmojis: string[]
  ): void {
    const list = commentsByPost.value[postId];
    if (!list) return;
    const idx = list.findIndex((c) => c.id === commentId);
    if (idx < 0) return;
    const updated = [...list];
    updated[idx] = { ...updated[idx], myEmojis };
    commentsByPost.value = { ...commentsByPost.value, [postId]: updated };
  }

  async function reactPostEmoji(postId: string, emoji: string): Promise<void> {
    const r = await api.post<{
      postId: string;
      emojiCounts: Record<string, number>;
      myEmojis: string[];
    }>(`/api/posts/${postId}/reactions`, { emoji });
    patchPostEmojiCounts(postId, r.emojiCounts);
    patchPostMyEmojis(postId, r.myEmojis);
  }

  async function reactCommentEmoji(
    postId: string,
    commentId: string,
    emoji: string
  ): Promise<void> {
    const r = await api.post<{
      postId: string;
      commentId: string;
      emojiCounts: Record<string, number>;
      myEmojis: string[];
    }>(
      `/api/posts/${postId}/reactions?commentId=${encodeURIComponent(commentId)}`,
      { emoji }
    );
    patchCommentEmojiCounts(postId, commentId, r.emojiCounts);
    patchCommentMyEmojis(postId, commentId, r.myEmojis);
  }

  async function loadComments(postId: string): Promise<void> {
    const list = await api.get<Comment[]>(`/api/posts/${postId}/comments`);
    commentsByPost.value = { ...commentsByPost.value, [postId]: list };
  }

  async function createComment(postId: string, body: string): Promise<Comment> {
    const c = await api.post<Comment>(`/api/posts/${postId}/comments`, { body });
    appendComment(postId, c);
    return c;
  }

  function appendComment(postId: string, comment: Comment): void {
    const list = commentsByPost.value[postId] ?? [];
    if (list.find((x) => x.id === comment.id)) return;
    commentsByPost.value = { ...commentsByPost.value, [postId]: [...list, comment] };
    const idx = posts.value.findIndex((p) => p.id === postId);
    if (idx >= 0) {
      posts.value.splice(idx, 1, {
        ...posts.value[idx],
        commentCount: posts.value[idx].commentCount + 1,
      });
    }
  }

  function removePost(postId: string): void {
    posts.value = posts.value.filter((p) => p.id !== postId);
    if (commentsByPost.value[postId]) {
      const next = { ...commentsByPost.value };
      delete next[postId];
      commentsByPost.value = next;
    }
  }

  function removeComment(postId: string, commentId: string): void {
    const list = commentsByPost.value[postId];
    if (list) {
      const filtered = list.filter((c) => c.id !== commentId);
      if (filtered.length !== list.length) {
        commentsByPost.value = { ...commentsByPost.value, [postId]: filtered };
      }
    }
    const idx = posts.value.findIndex((p) => p.id === postId);
    if (idx >= 0 && posts.value[idx].commentCount > 0) {
      posts.value.splice(idx, 1, {
        ...posts.value[idx],
        commentCount: posts.value[idx].commentCount - 1,
      });
    }
  }

  async function deletePost(eventId: string, postId: string): Promise<void> {
    await api.del(`/api/events/${eventId}/posts?postId=${encodeURIComponent(postId)}`);
    removePost(postId);
  }

  async function deleteComment(postId: string, commentId: string): Promise<void> {
    await api.del(
      `/api/posts/${postId}/comments?commentId=${encodeURIComponent(commentId)}`
    );
    removeComment(postId, commentId);
  }

  function reset(): void {
    posts.value = [];
    commentsByPost.value = {};
    nextCursor.value = null;
  }

  return {
    posts,
    commentsByPost,
    nextCursor,
    loading,
    loadFirstPage,
    loadMore,
    createPost,
    prependPost,
    patchReactions,
    react,
    reactPostEmoji,
    reactCommentEmoji,
    patchPostEmojiCounts,
    patchCommentEmojiCounts,
    loadComments,
    createComment,
    appendComment,
    removePost,
    removeComment,
    deletePost,
    deleteComment,
    reset,
  };
});
