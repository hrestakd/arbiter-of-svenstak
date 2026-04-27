<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const router = useRouter();
const session = useSessionStore();

onMounted(async () => {
  if (!session.probed) await session.probe();
  if (session.isAdmin) await router.replace({ name: 'admin-dashboard' });
});
</script>

<template>
  <main class="min-h-screen flex items-center justify-center p-4 sm:p-8">
    <div class="card max-w-md w-full text-center space-y-4">
      <h1 class="text-2xl">Admin Sign In</h1>
      <p class="text-muted text-sm">
        Only the two organizers (Domagoj and Sven) are on the allowlist.
      </p>
      <a class="btn w-full inline-flex justify-center" href="/api/auth/github">
        <span aria-hidden="true">🐙</span>
        <span>Sign in with GitHub</span>
      </a>
      <p class="text-xs text-muted">
        After signing in you'll be redirected back to the admin dashboard.
      </p>
    </div>
  </main>
</template>
