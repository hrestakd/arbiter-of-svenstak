/**
 * POST /api/posts/:id/reactions
 * Body: { kind: 'like' | 'dislike' }
 *
 * Upsert the caller's reaction. Posting the same kind again removes it
 * (toggle); posting a different kind replaces it.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { queryOne, withTransaction } from '../../_lib/db';
import {
  fail,
  internal,
  methodNotAllowed,
  notFound,
  unauthorized,
} from '../../_lib/errors';
import { readAttendeeSession } from '../../_lib/session';
import { ReactionCreate } from '../../_lib/schemas';
import { trigger } from '../../_lib/pusher';

interface CountsRow {
  like_count: string;
  dislike_count: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  const postId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!postId) return fail(res, 400, 'BAD_ID', 'Missing post id');

  try {
    const session = await readAttendeeSession(req);
    if (!session) return unauthorized(res);

    const post = await queryOne<{ id: string; event_id: string }>(
      'SELECT id, event_id FROM posts WHERE id = $1',
      [postId]
    );
    if (!post) return notFound(res, 'Post not found.');
    if (post.event_id !== session.eventId) {
      return fail(res, 403, 'WRONG_EVENT', 'Wrong event for this session.');
    }

    const parsed = ReactionCreate.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
    }
    const kind = parsed.data.kind;

    const counts = await withTransaction(async (tx) => {
      const existing = await tx.query<{ kind: 'like' | 'dislike' }>(
        'SELECT kind FROM post_reactions WHERE post_id = $1 AND attendee_id = $2',
        [postId, session.attendeeId]
      );
      if (existing.length === 0) {
        await tx.query(
          'INSERT INTO post_reactions (post_id, attendee_id, kind) VALUES ($1, $2, $3)',
          [postId, session.attendeeId, kind]
        );
      } else if (existing[0].kind === kind) {
        await tx.query(
          'DELETE FROM post_reactions WHERE post_id = $1 AND attendee_id = $2',
          [postId, session.attendeeId]
        );
      } else {
        await tx.query(
          'UPDATE post_reactions SET kind = $3 WHERE post_id = $1 AND attendee_id = $2',
          [postId, session.attendeeId, kind]
        );
      }

      const c = await tx.query<CountsRow>(
        `SELECT
            COALESCE(SUM(CASE WHEN kind = 'like'    THEN 1 ELSE 0 END), 0)::text AS like_count,
            COALESCE(SUM(CASE WHEN kind = 'dislike' THEN 1 ELSE 0 END), 0)::text AS dislike_count
           FROM post_reactions
          WHERE post_id = $1`,
        [postId]
      );
      return c[0];
    });

    const payload = {
      postId,
      likeCount: Number(counts.like_count),
      dislikeCount: Number(counts.dislike_count),
    };
    void trigger(post.event_id, 'post:updated', payload);
    res.status(200).json(payload);
  } catch (err) {
    internal(res, err);
  }
}
