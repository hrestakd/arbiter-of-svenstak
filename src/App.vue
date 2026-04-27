<script setup lang="ts">
import { onMounted } from 'vue';
import { useSessionStore } from '@/stores/session';
import AdminBadge from '@/components/AdminBadge.vue';

const session = useSessionStore();

onMounted(() => {
  void session.probe();
});
</script>

<template>
  <RouterView />
  <AdminBadge />
</template>
