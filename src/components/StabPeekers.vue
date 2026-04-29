<script setup lang="ts">
/**
 * Two portraits (Hrestak and Sven) that intermittently slide out from behind
 * the parent card. Each runs its own random 1–5s schedule, and each pop
 * chooses a fresh random rotation + small vertical offset so the angle
 * differs every time. The portraits pivot around the corner that touches
 * the card so the tilt reads as "leaning out from behind".
 *
 * The component positions itself absolutely inside a `position: relative`
 * parent — that parent must contain the card whose edges the portraits
 * peek out from.
 */

import { onBeforeUnmount, onMounted, ref } from 'vue';

const SLIDE_MS = 900;
const HOLD_MS = 500;
const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 3000;

interface PeekState {
  /** translateX value while hidden / shown (% of own width). */
  x: number;
  /** translateY value while shown (% of own height). */
  y: number;
  /** rotate in degrees. */
  rot: number;
}

// Hrestak peeks from the RIGHT, Sven from the LEFT.
const hrestState = ref<PeekState>({ x: -100, y: 0, rot: 0 });
const svenState = ref<PeekState>({ x: 100, y: 0, rot: 0 });

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

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randDelay(): number {
  return rand(MIN_DELAY_MS, MAX_DELAY_MS);
}

function transformFor(s: PeekState): string {
  return `translate(${s.x}%, ${s.y}%) rotate(${s.rot}deg)`;
}

async function loop(
  side: 'left' | 'right',
  set: (v: PeekState) => void,
  initialDelay: number
): Promise<void> {
  const hiddenX = side === 'left' ? 100 : -100;
  await delay(initialDelay);
  while (!cancelled) {
    // Magnitude between 30° and 120°. The sign follows the side so each
    // peeker leans away from the card edge it pivots on.
    const magnitude = rand(30, 120);
    const rot = side === 'left' ? -magnitude : magnitude;
    const y = rand(-8, 8);
    set({ x: 0, y, rot });
    await delay(SLIDE_MS + HOLD_MS);
    if (cancelled) return;
    // Retract — return to hidden translation, untilted.
    set({ x: hiddenX, y: 0, rot: 0 });
    await delay(SLIDE_MS + randDelay());
  }
}

onMounted(() => {
  void loop('right', (v) => (hrestState.value = v), 800 + Math.random() * 1500);
  void loop('left', (v) => (svenState.value = v), 2200 + Math.random() * 1500);
});

onBeforeUnmount(() => {
  cancelled = true;
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
});
</script>

<template>
  <img
    src="/SvenStab.webp"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="stab-peeker stab-peeker--left"
    :style="{ transform: transformFor(svenState) }"
  />
  <img
    src="/HrestStab.webp"
    alt=""
    aria-hidden="true"
    loading="lazy"
    decoding="async"
    class="stab-peeker stab-peeker--right"
    :style="{ transform: transformFor(hrestState) }"
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
  /* Slow, soft easing; both translate AND rotate animate. */
  transition: transform 900ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* Pivot around the corner that touches the card so the tilt reads as the
   image leaning out from behind. */
.stab-peeker--left {
  right: 100%;
  transform-origin: right bottom;
}
.stab-peeker--right {
  left: 100%;
  transform-origin: left bottom;
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
