/**
 * GET /api/events/current
 * Public endpoint returning the event flagged is_current=true.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../_lib/db.js';
import { internal, methodNotAllowed, notFound } from '../_lib/errors.js';

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
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }
  try {
    const row = await queryOne<EventRow>(
      `SELECT id, year, title, theme, description, location, starts_at,
              header_image_url, payment_tags, is_current
         FROM events
        WHERE is_current = true
        LIMIT 1`
    );
    if (!row) return notFound(res, 'No current event has been published yet.');
    res.status(200).json(serializeEvent(row));
  } catch (err) {
    internal(res, err);
  }
}

export function serializeEvent(row: EventRow) {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    theme: row.theme,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    headerImageUrl: row.header_image_url,
    paymentTags: row.payment_tags,
    isCurrent: row.is_current,
  };
}
