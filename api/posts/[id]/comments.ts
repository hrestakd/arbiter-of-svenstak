/**
 * /api/posts/:id/comments
 *   GET  — list comments oldest → newest
 *   POST — create comment (rate-limited 1 / 5s per attendee)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne } from '../../_lib/db.js';
import {
  fail,
  internal,
  methodNotAllowed,
  notFound,
  tooManyRequests,
  unauthorized,
} from '../../_lib/errors.js';
import { incrWithExpiry } from '../../_lib/kv.js';
import { readAttendeeSession } from '../../_lib/session.js';
import { CommentCreate } from '../../_lib/schemas.js';
import { trigger } from '../../_lib/pusher.js';

interface CommentRow {
  id: string;
  post_id: string;
  attendee_id: string;
  body: string;
  created_at: string;
  first_name: string;
  last_name: string;
}

function serializeComment(r: CommentRow) {
  return {
    id: r.id,
    postId: r.post_id,
    attendeeId: r.attendee_id,
    body: r.body,
    createdAt: r.created_at,
    author: { firstName: r.first_name, lastName: r.last_name },
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[posts/comments]', req.method, 'postId=', req.query.id);
  const postId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!postId) return fail(res, 400, 'BAD_ID', 'Missing post id');

  try {
    const post = await queryOne<{ id: string; event_id: string }>(
      'SELECT id, event_id FROM posts WHERE id = $1',
      [postId]
    );
    if (!post) return notFound(res, 'Post not found.');

    if (req.method === 'GET') {
      // Public read.
      const rows = await query<CommentRow>(
        `SELECT c.id, c.post_id, c.attendee_id, c.body, c.created_at,
                a.first_name, a.last_name
           FROM comments c
           JOIN attendees a ON a.id = c.attendee_id
          WHERE c.post_id = $1
          ORDER BY c.created_at ASC`,
        [postId]
      );
      return void res.status(200).json(rows.map(serializeComment));
    }

    // Writes still require an attendee session for the matching event.
    const session = await readAttendeeSession(req);
    if (!session) return unauthorized(res);
    if (post.event_id !== session.eventId) {
      return fail(res, 403, 'WRONG_EVENT', 'Wrong event for this session.');
    }

    if (req.method === 'POST') {
      const parsed = CommentCreate.safeParse(req.body);
      if (!parsed.success) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
      }

      const count = await incrWithExpiry(`rl:comment:${session.attendeeId}`, 5);
      if (count > 1) return tooManyRequests(res, 5);

      const inserted = await queryOne<{ id: string; created_at: string }>(
        `INSERT INTO comments (post_id, attendee_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, created_at`,
        [postId, session.attendeeId, parsed.data.body]
      );
      if (!inserted) throw new Error('Insert returned no row');

      const row = await queryOne<CommentRow>(
        `SELECT c.id, c.post_id, c.attendee_id, c.body, c.created_at,
                a.first_name, a.last_name
           FROM comments c
           JOIN attendees a ON a.id = c.attendee_id
          WHERE c.id = $1`,
        [inserted.id]
      );
      if (!row) throw new Error('Comment vanished after insert');

      void trigger(post.event_id, 'comment:new', {
        postId,
        comment: serializeComment(row),
      });
      return void res.status(201).json(serializeComment(row));
    }

    return methodNotAllowed(res, ['GET', 'POST']);
  } catch (err) {
    internal(res, err);
  }
}
