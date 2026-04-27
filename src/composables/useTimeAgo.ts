/**
 * Format an ISO timestamp as a relative phrase ("3m ago", "2h ago").
 * Reactive: re-runs on a 60s interval so the UI ages naturally.
 */

import { onScopeDispose, ref, type Ref } from 'vue';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function format(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  if (abs < MINUTE) return 'just now';
  if (abs < HOUR) return `${Math.floor(abs / MINUTE)}m ago`;
  if (abs < DAY) return `${Math.floor(abs / HOUR)}h ago`;
  if (abs < 7 * DAY) return `${Math.floor(abs / DAY)}d ago`;
  return new Date(Date.now() - deltaMs).toLocaleDateString();
}

export function useTimeAgo(iso: string): Ref<string> {
  const out = ref(format(Date.now() - new Date(iso).getTime()));
  const handle = window.setInterval(() => {
    out.value = format(Date.now() - new Date(iso).getTime());
  }, 60_000);
  onScopeDispose(() => window.clearInterval(handle));
  return out;
}
