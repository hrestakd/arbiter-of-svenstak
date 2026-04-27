/**
 * GET /api/events
 * Returns a lightweight list of all events for the archive page.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query } from '../_lib/db';
import { internal, methodNotAllowed } from '../_lib/errors';

interface ListRow {
  id: string;
  year: number;
  title: string;
  theme: string | null;
  starts_at: string;
  header_image_url: string | null;
  is_current: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const rows = await query<ListRow>(
      `SELECT id, year, title, theme, starts_at, header_image_url, is_current
         FROM events
        ORDER BY year DESC`
    );
    res.status(200).json(
      rows.map((r) => ({
        id: r.id,
        year: r.year,
        title: r.title,
        theme: r.theme,
        startsAt: r.starts_at,
        headerImageUrl: r.header_image_url,
        isCurrent: r.is_current,
      }))
    );
  } catch (err) {
    internal(res, err);
  }
}
