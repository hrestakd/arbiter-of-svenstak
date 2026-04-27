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
}

export interface Post {
  id: string;
  eventId: string;
  attendeeId: string;
  body: string;
  createdAt: string;
  author: Author;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  attendeeId: string;
  body: string;
  createdAt: string;
  author: Author;
}

export interface Attendee {
  id: string;
  eventId: string;
  firstName: string;
  lastName: string;
  attendance: Attendance;
  plusOne: boolean;
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

  async function createPost(eventId: string, body: string): Promise<Post> {
    const post = await api.post<Post>(`/api/events/${eventId}/posts`, { body });
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
    loadComments,
    createComment,
    appendComment,
    reset,
  };
});
