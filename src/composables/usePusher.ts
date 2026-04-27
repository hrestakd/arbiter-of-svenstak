/**
 * Singleton Pusher client. Lives for the lifetime of the SPA tab.
 * Configured via VITE_PUSHER_KEY and VITE_PUSHER_CLUSTER.
 */

import Pusher from 'pusher-js';

let client: Pusher | undefined;

export function getPusher(): Pusher {
  if (!client) {
    const key = import.meta.env.VITE_PUSHER_KEY;
    const cluster = import.meta.env.VITE_PUSHER_CLUSTER;
    if (!key || !cluster) {
      throw new Error('VITE_PUSHER_KEY / VITE_PUSHER_CLUSTER are not set');
    }
    client = new Pusher(key, { cluster });
  }
  return client;
}
