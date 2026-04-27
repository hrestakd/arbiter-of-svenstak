/**
 * PATCH /api/events/:id/attendees/me
 * Update the caller's own attendance / plus-one. The attendee_session
 * cookie identifies them.
 *
 * Has its own file (instead of folding into the [...rest] catch-all) because
 * Vercel's filesystem routing doesn't reliably match the 2-segment path
 * `attendees/me` against the parent's catch-all.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne } from '../../../_lib/db.js';
import {
  fail,
  internal,
  methodNotAllowed,
  unauthorized,
} from '../../../_lib/errors.js';
import { readAttendeeSession } from '../../../_lib/session.js';
import { AttendeePatch } from '../../../_lib/schemas.js';
import { trigger } from '../../../_lib/pusher.js';

interface AttendeeRow {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  attendance: 'attending' | 'maybe' | 'no_go';
  plus_one: boolean;
  created_at: string;
}

function serializeAttendee(r: AttendeeRow) {
  return {
    id: r.id,
    eventId: r.event_id,
    firstName: r.first_name,
    lastName: r.last_name,
    attendance: r.attendance,
    plusOne: r.plus_one,
    createdAt: r.created_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[events/attendees/me]', req.method, 'eventId=', req.query.id);

  const eventId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!eventId) return fail(res, 400, 'BAD_ID', 'Missing event id');
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

  try {
    const session = await readAttendeeSession(req);
    if (!session) return unauthorized(res);
    if (session.eventId !== eventId) {
      return fail(res, 403, 'WRONG_EVENT', 'Your session belongs to a different event.');
    }

    const parsed = AttendeePatch.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
    }

    const sets: string[] = [];
    const params: unknown[] = [];
    if (parsed.data.attendance !== undefined) {
      params.push(parsed.data.attendance);
      sets.push(`attendance = $${params.length}`);
    }
    if (parsed.data.plusOne !== undefined) {
      params.push(parsed.data.plusOne);
      sets.push(`plus_one = $${params.length}`);
    }
    sets.push('updated_at = now()');
    params.push(session.attendeeId);

    const row = await queryOne<AttendeeRow>(
      `UPDATE attendees SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, event_id, first_name, last_name, attendance, plus_one, created_at`,
      params
    );
    if (!row) return unauthorized(res);

    void trigger(eventId, 'attendee:updated', { attendee: serializeAttendee(row) });
    res.status(200).json(serializeAttendee(row));
  } catch (err) {
    internal(res, err);
  }
}
