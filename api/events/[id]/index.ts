/**
 * GET /api/events/:id — fetch event by id (used by admin edit form).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../../_lib/db.js';
import { fail, internal, methodNotAllowed, notFound } from '../../_lib/errors.js';
import { EVENT_COLUMNS, serializeEvent } from '../current.js';

interface EventRow {
  id: string;
  year: number;
  title: string;
  theme: string | null;
  description: string;
  location: string;
  location_map_url: string | null;
  starts_at: string;
  header_image_url: string | null;
  payment_tags: unknown;
  is_current: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[events/by-id]', req.method, 'id=', req.query.id);
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const id = typeof req.query.id === 'string' ? req.query.id : null;
  if (!id) return fail(res, 400, 'BAD_ID', 'Missing event id');
  try {
    const row = await queryOne<EventRow>(
      `SELECT ${EVENT_COLUMNS} FROM events WHERE id = $1`,
      [id]
    );
    if (!row) return notFound(res);
    res.status(200).json(serializeEvent(row));
  } catch (err) {
    internal(res, err);
  }
}
