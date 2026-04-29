<script setup lang="ts">
/**
 * Two portraits (Hrestak and Sven) that intermittently slide out from behind
 * the parent card. Each runs its own random 1–5s schedule. The component
 * positions itself absolutely inside a `position: relative` parent — that
 * parent must contain the card whose edges the portraits peek out from.
 */

import { onBeforeUnmount, onMounted, ref } from 'vue';

const SLIDE_MS = 900;
const HOLD_MS = 1000;
const MIN_DELAY_MS = 1000;
const MAX_DELAY_MS = 5000;

const hrestShown = ref(false);
const svenShown = ref(false);

let cancelled = false;
const timers = new Set<number>();

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      resolve();
    }, ms);
    timers.add(id);
  });
}

function randDelay(): number {
  return MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS);
}

async function loop(set: (v: boolean) => void, initialDelay: number): Promise<void> {
  await delay(initialDelay);
  while (!cancelled) {
    set(true);
    // Wait through the slide-in plus the dwell.
    await delay(SLIDE_MS + HOLD_MS);
    if (cancelled) return;
    set(false);
    // Wait through the slide-out plus a fresh random gap before next pop.
    await delay(SLIDE_MS + randDelay());
  }
}

onMounted(() => {
  // Stagger the two so they don't lock-step into the same rhythm.
  void loop((v) => (hrestShown.value = v), 800 + Math.random() * 1500);
  void loop((v) => (svenShown.value = v), 2200 + Math.random() * 1500);
});

onBeforeUnmount(() => {
  cancelled = true;
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
});
</script>

<template>
  <img
    src="/HrestStab.webp"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="stab-peeker stab-peeker--left"
    :class="{ 'is-shown': hrestShown }"
  />
  <img
    src="/SvenStab.webp"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="stab-peeker stab-peeker--right"
    :class="{ 'is-shown': svenShown }"
  />
</template>

<style scoped>
.stab-peeker {
  position: absolute;
  bottom: 0;
  height: 14rem;
  width: auto;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  /* Slow, soft easing so the slide reads as a sneaky peek rather than a snap. */
  transition: transform 900ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

.stab-peeker--left {
  right: 100%;
  transform: translateX(100%);
}
.stab-peeker--left.is-shown {
  transform: translateX(0);
}

.stab-peeker--right {
  left: 100%;
  transform: translateX(-100%);
}
.stab-peeker--right.is-shown {
  transform: translateX(0);
}

@media (min-width: 640px) {
  .stab-peeker { height: 18rem; }
}
@media (min-width: 1024px) {
  .stab-peeker { height: 22rem; }
}

@media (prefers-reduced-motion: reduce) {
  .stab-peeker { display: none; }
}
</style>
