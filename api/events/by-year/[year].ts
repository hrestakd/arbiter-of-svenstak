/**
 * GET /api/events/by-year/:year
 * Returns a specific year's event for the archive view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../../_lib/db.js';
import { fail, internal, methodNotAllowed, notFound } from '../../_lib/errors.js';
import { serializeEvent } from '../current.js';

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
  console.log('[events/by-year]', req.method, 'year=', req.query.year);
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const yearStr = typeof req.query.year === 'string' ? req.query.year : null;
  const year = yearStr ? Number.parseInt(yearStr, 10) : NaN;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return fail(res, 400, 'BAD_YEAR', 'Year must be between 2000 and 2100.');
  }

  try {
    const row = await queryOne<EventRow>(
      `SELECT id, year, title, theme, description, location, starts_at,
              header_image_url, payment_tags, is_current
         FROM events
        WHERE year = $1`,
      [year]
    );
    if (!row) return notFound(res, `No event for year ${year}.`);
    res.status(200).json(serializeEvent(row));
  } catch (err) {
    internal(res, err);
  }
}
