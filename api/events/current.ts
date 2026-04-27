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
  location_map_url: string | null;
  starts_at: string;
  header_image_url: string | null;
  payment_tags: unknown;
  is_current: boolean;
}

export const EVENT_COLUMNS = `id, year, title, theme, description, location, location_map_url,
              starts_at, header_image_url, payment_tags, is_current`;

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[events/current]', req.method);
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }
  try {
    const row = await queryOne<EventRow>(
      `SELECT ${EVENT_COLUMNS}
         FROM events
        WHERE is_current = true
        LIMIT 1`
    );
    console.log('[events/current] found=', !!row, row ? `id=${row.id} year=${row.year}` : '');
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
    locationMapUrl: row.location_map_url,
    startsAt: row.starts_at,
    headerImageUrl: row.header_image_url,
    paymentTags: row.payment_tags,
    isCurrent: row.is_current,
  };
}
