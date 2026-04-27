/**
 * Upstash Redis helper (Vercel Marketplace KV).
 *
 * Used for: admin sessions, OAuth state nonces, rate-limit counters.
 * Reads $KV_REST_API_URL and $KV_REST_API_TOKEN.
 */

import { Redis } from '@upstash/redis';

let client: Redis | undefined;

export function kv(): Redis {
  if (!client) {
    // Vercel Marketplace exposes Upstash under one of two naming schemes
    // depending on how/when the integration was installed.
    const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Redis env vars not set. Expected KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN.'
      );
    }
    client = new Redis({ url, token });
  }
  return client;
}

/** Increment a counter that auto-expires after `windowSeconds`. Returns the new count. */
export async function incrWithExpiry(
  key: string,
  windowSeconds: number
): Promise<number> {
  const r = kv();
  const count = await r.incr(key);
  if (count === 1) {
    await r.expire(key, windowSeconds);
  }
  return count;
}
