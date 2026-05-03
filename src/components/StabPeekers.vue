<script setup lang="ts">
/**
 * Two portraits (Hrestak and Sven) that intermittently slide out from behind
 * the parent card. Each runs its own random schedule, and each pop chooses
 * a fresh random rotation so the angle differs every time. The portraits
 * pivot around the corner that touches the card so the tilt reads as
 * "leaning out from behind".
 *
 * Each img is wrapped in a div so the slide-and-rotate and the vibration
 * can use independent `transform`s (a single element can't animate transform
 * via both a CSS transition and a keyframe animation simultaneously).
 *
 * Mobile (≤ 767px) inverts the choreography: the parent card fills the
 * viewport, so there's no gutter for the portraits to slide into. They
 * instead anchor at the screen edge and slide INWARD, overlaying the card.
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
const PEEK_HIDDEN_PCT = 30;
const MOBILE_QUERY = '(max-width: 767px)';

interface PeekState {
  /** translateX value while hidden / shown (% of own width). */
  x: number;
  /** translateY value while shown (% of own height). */
  y: number;
  /** rotate in degrees. */
  rot: number;
}

// orient = +1 desktop (peekers slide outward, away from card edge);
//        = -1 mobile  (peekers slide inward, from screen edge into the card).
const initialIsMobile =
  typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
const isMobile = ref(initialIsMobile);
function orient(): -1 | 1 {
  return isMobile.value ? -1 : 1;
}

// Hrestak peeks from the RIGHT, Sven from the LEFT. Initial hidden state
// matches whichever orientation we booted in so there's no first-frame flash.
const hrestState = ref<PeekState>({ x: orient() * -100, y: 0, rot: 0 });
const svenState = ref<PeekState>({ x: orient() * 100, y: 0, rot: 0 });
const hrestVibrating = ref(false);
const svenVibrating = ref(false);

let cancelled = false;
const timers = new Set<number>();
let mq: MediaQueryList | null = null;

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
  setVibrating: (v: boolean) => void,
  initialDelay: number
): Promise<void> {
  await delay(initialDelay);
  while (!cancelled) {
    // Re-read orient each cycle so the next pop after a viewport-resize
    // picks up the new orientation.
    const o = orient();
    const hiddenX = o * (side === 'left' ? 100 : -100);
    const shownX = o * (side === 'left' ? PEEK_HIDDEN_PCT : -PEEK_HIDDEN_PCT);
    const magnitude = rand(30, 120);
    const rot = o * (side === 'left' ? -magnitude : magnitude);
    const y = rand(-8, 8);

    // Slide-in: vibrate while moving, then settle.
    setVibrating(true);
    set({ x: shownX, y, rot });
    await delay(SLIDE_MS);
    if (cancelled) return;
    setVibrating(false);
    await delay(HOLD_MS);
    if (cancelled) return;

    // Retract — vibrate during the slide-out too.
    setVibrating(true);
    set({ x: hiddenX, y: 0, rot: 0 });
    await delay(SLIDE_MS);
    if (cancelled) return;
    setVibrating(false);
    await delay(randDelay());
  }
}

function onMqChange(e: MediaQueryListEvent): void {
  isMobile.value = e.matches;
}

onMounted(() => {
  mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', onMqChange);
  void loop(
    'right',
    (v) => (hrestState.value = v),
    (v) => (hrestVibrating.value = v),
    800 + Math.random() * 1500
  );
  void loop(
    'left',
    (v) => (svenState.value = v),
    (v) => (svenVibrating.value = v),
    2200 + Math.random() * 1500
  );
});

onBeforeUnmount(() => {
  cancelled = true;
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
  mq?.removeEventListener('change', onMqChange);
});
</script>

<template>
  <div
    class="stab-peeker stab-peeker--left"
    :style="{ transform: transformFor(svenState) }"
  >
    <img
      src="/SvenStab.webp"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      class="stab-peeker__img"
      :class="{ 'is-vibrating': svenVibrating }"
    />
  </div>
  <div
    class="stab-peeker stab-peeker--right"
    :style="{ transform: transformFor(hrestState) }"
  >
    <img
      src="/HrestStab.webp"
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      class="stab-peeker__img"
      :class="{ 'is-vibrating': hrestVibrating }"
    />
  </div>
</template>

<style scoped>
.stab-peeker {
  position: absolute;
  bottom: 0;
  height: 14rem;
  /* Without an explicit width, an absolutely-positioned wrapper with
     width: auto can collapse to 0, which hides the img inside. max-content
     forces the wrapper to size to the img's natural width at the given
     height. */
  width: max-content;
  pointer-events: none;
  user-select: none;
  z-index: 0;
  /* Slow, soft easing; both translate AND rotate animate. */
  transition: transform 900ms cubic-bezier(0.22, 0.61, 0.36, 1);
  will-change: transform;
}

/* Desktop: peekers anchor OUTSIDE the card edges and slide outward. They
   sit behind the card (z-0 < article z-10) so retracted = hidden. */
.stab-peeker--left {
  right: 100%;
  transform-origin: right bottom;
}
.stab-peeker--right {
  left: 100%;
  transform-origin: left bottom;
}

/* Mobile: card fills the viewport, so there's nowhere to slide outward to.
   Anchor at the screen edge, slide INWARD, and z-index above the article so
   the portraits overlay the card content while shown. */
@media (max-width: 767px) {
  .stab-peeker {
    z-index: 20;
  }
  .stab-peeker--left {
    right: auto;
    left: 0;
    transform-origin: left bottom;
  }
  .stab-peeker--right {
    left: auto;
    right: 0;
    transform-origin: right bottom;
  }
}

.stab-peeker__img {
  display: block;
  height: 100%;
  width: auto;
  will-change: transform;
}

/* Slight rapid jitter while the wrapper is sliding — the wrapper handles
   the macro slide+tilt, the img handles micro shake on top. Stops when the
   `is-vibrating` class is removed. */
.stab-peeker__img.is-vibrating {
  animation: stab-vibrate 200ms linear infinite;
}

@keyframes stab-vibrate {
  0%   { transform: translate(0, 0) rotate(0deg); }
  20%  { transform: translate(-1.5px, 1px) rotate(-0.6deg); }
  40%  { transform: translate(1.5px, -1px) rotate(0.6deg); }
  60%  { transform: translate(-2px, -4px) rotate(-0.4deg); }
  80%  { transform: translate(1px, 1.5px) rotate(0.4deg); }
  100% { transform: translate(0, 0) rotate(0deg); }
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
