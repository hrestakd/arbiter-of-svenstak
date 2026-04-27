/**
 * /api/admin/events/:id
 *   PATCH  — partial update; if isCurrent toggled true, demote others
 *   DELETE — remove event (cascades to attendees/posts/poll)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withTransaction } from '../../_lib/db';
import {
  fail,
  internal,
  methodNotAllowed,
  notFound,
  unauthorized,
} from '../../_lib/errors';
import { readAdminSession } from '../../_lib/session';
import { EventPatch } from '../../_lib/schemas';
import { trigger } from '../../_lib/pusher';
import { serializeEvent } from '../../events/current';

interface EventRow {
  id: string;
  year: number;
  title: string;
  theme: string | null;
  description: string;
  location: string;
  starts_at: string;
  header_image_url: string | null;
  payment_tags: unknown;
  is_current: boolean;
}

const FIELD_MAP: Record<string, string> = {
  year: 'year',
  title: 'title',
  theme: 'theme',
  description: 'description',
  location: 'location',
  startsAt: 'starts_at',
  headerImageUrl: 'header_image_url',
  isCurrent: 'is_current',
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return fail(res, 400, 'BAD_ID', 'Missing event id');

  try {
    const admin = await readAdminSession(req);
    if (!admin) return unauthorized(res);

    if (req.method === 'PATCH') return patch(req, res, id);
    if (req.method === 'DELETE') return remove(req, res, id);
    return methodNotAllowed(res, ['PATCH', 'DELETE']);
  } catch (err) {
    internal(res, err);
  }
}

async function patch(req: VercelRequest, res: VercelResponse, id: string): Promise<void> {
  const parsed = EventPatch.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
  }
  const v = parsed.data;

  const event = await withTransaction(async (tx) => {
    if (v.isCurrent === true) {
      await tx.query(
        'UPDATE events SET is_current = false WHERE is_current = true AND id <> $1',
        [id]
      );
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(FIELD_MAP)) {
      const value = v[key as keyof typeof v];
      if (value !== undefined) {
        params.push(value);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (v.paymentTags !== undefined) {
      params.push(JSON.stringify(v.paymentTags));
      sets.push(`payment_tags = $${params.length}::jsonb`);
    }
    if (sets.length === 0) {
      // No-op; just return current row.
      const rows = await tx.query<EventRow>(
        `SELECT id, year, title, theme, description, location, starts_at,
                header_image_url, payment_tags, is_current
           FROM events WHERE id = $1`,
        [id]
      );
      return rows[0] ?? null;
    }
    sets.push('updated_at = now()');
    params.push(id);

    const rows = await tx.query<EventRow>(
      `UPDATE events SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, year, title, theme, description, location, starts_at,
                  header_image_url, payment_tags, is_current`,
      params
    );
    return rows[0] ?? null;
  });

  if (!event) return notFound(res, 'Event not found.');
  void trigger(event.id, 'event:updated', { event: serializeEvent(event) });
  res.status(200).json(serializeEvent(event));
}

async function remove(_req: VercelRequest, res: VercelResponse, id: string): Promise<void> {
  const ok = await withTransaction(async (tx) => {
    const rows = await tx.query('DELETE FROM events WHERE id = $1 RETURNING id', [id]);
    return rows.length === 1;
  });
  if (!ok) return notFound(res, 'Event not found.');
  res.status(204).end();
}
