/**
 * Server-side Pusher Channels client. Single trigger() helper so every API
 * route fans out the same way. Best-effort — failures are logged but don't
 * fail the originating request, since Pusher being down shouldn't block
 * a successful Postgres write.
 */

import Pusher from 'pusher';

let client: Pusher | undefined;

function getClient(): Pusher {
  if (!client) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.PUSHER_KEY;
    const sec = process.env.PUSHER_SECRET;
    const cluster = process.env.PUSHER_CLUSTER;
    if (!appId || !key || !sec || !cluster) {
      throw new Error('PUSHER_APP_ID/KEY/SECRET/CLUSTER are not set');
    }
    client = new Pusher({
      appId,
      key,
      secret: sec,
      cluster,
      useTLS: true,
    });
  }
  return client;
}

export async function trigger(
  eventId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await getClient().trigger(`event-${eventId}`, event, payload);
  } catch (err) {
    console.error('[pusher] trigger failed', { eventId, event, err });
  }
}
