<script setup lang="ts">
/**
 * Floating bottom-right widget for admin auth.
 *   - Signed out: small GitHub logo → starts the OAuth flow.
 *   - Signed in:  username chip linking to /admin + a small sign-out button.
 *
 * Visible on every route via App.vue.
 */

import { useSessionStore } from '@/stores/session';
import { useRouter } from 'vue-router';

const session = useSessionStore();
const router = useRouter();

async function logout(): Promise<void> {
  await session.logoutAdmin();
  // Stay on the current public page after sign-out; if we're on an admin
  // route, bounce home so the route guard doesn't immediately complain.
  if (router.currentRoute.value.path.startsWith('/admin')) {
    await router.push('/');
  }
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-50 print:hidden">
    <a
      v-if="!session.isAdmin"
      href="/api/auth/github"
      class="flex items-center justify-center w-10 h-10 rounded-full bg-surface text-muted hover:text-ink shadow-sm border border-muted/20 transition-colors"
      aria-label="Admin sign in with GitHub"
      title="Admin sign in"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" class="w-5 h-5" aria-hidden="true">
        <path
          d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
    </a>

    <div
      v-else
      class="flex items-center gap-1 rounded-full bg-surface border border-muted/20 shadow-sm pl-3 pr-1 py-1"
    >
      <RouterLink
        :to="{ name: 'admin-dashboard' }"
        class="text-sm hover:text-accent"
        title="Admin dashboard"
      >
        @{{ session.admin?.username }}
      </RouterLink>
      <button
        type="button"
        class="text-xs text-muted hover:text-danger px-2 py-0.5 rounded-full hover:bg-bg/40 transition-colors"
        title="Sign out"
        aria-label="Sign out"
        @click="logout"
      >
        ✕
      </button>
    </div>
  </div>
</template>
