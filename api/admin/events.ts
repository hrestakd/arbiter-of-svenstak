/**
 * POST /api/admin/events
 * Create a new event. Admin auth required. If isCurrent is true, demote
 * any existing current event in the same transaction.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { withTransaction } from '../_lib/db.js';
import {
  fail,
  internal,
  methodNotAllowed,
  unauthorized,
} from '../_lib/errors.js';
import { readAdminSession } from '../_lib/session.js';
import { EventUpsert } from '../_lib/schemas.js';
import { trigger } from '../_lib/pusher.js';
import { serializeEvent } from '../events/current.js';

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const admin = await readAdminSession(req);
    if (!admin) return unauthorized(res);

    const parsed = EventUpsert.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
    }
    const v = parsed.data;

    const event = await withTransaction(async (tx) => {
      if (v.isCurrent) {
        await tx.query('UPDATE events SET is_current = false WHERE is_current = true');
      }
      const rows = await tx.query<EventRow>(
        `INSERT INTO events
           (year, title, theme, description, location, starts_at,
            header_image_url, payment_tags, is_current, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)
         RETURNING id, year, title, theme, description, location, starts_at,
                   header_image_url, payment_tags, is_current`,
        [
          v.year,
          v.title,
          v.theme ?? null,
          v.description ?? '',
          v.location ?? '',
          v.startsAt,
          v.headerImageUrl ?? null,
          JSON.stringify(v.paymentTags ?? []),
          v.isCurrent,
          admin.username,
        ]
      );
      return rows[0];
    });

    void trigger(event.id, 'event:updated', { event: serializeEvent(event) });
    res.status(201).json(serializeEvent(event));
  } catch (err) {
    internal(res, err);
  }
}
