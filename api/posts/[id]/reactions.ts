/**
 * POST /api/posts/:id/reactions
 *
 * Two body shapes:
 *
 *   1. { kind: 'like' | 'dislike' }
 *      Existing toggle of the binary like/dislike on a post (post_reactions
 *      table). Same kind again removes; different kind replaces.
 *
 *   2. { emoji: '❤️' }
 *      Slack-style emoji toggle. Targets the parent post by default. Pass
 *      ?commentId=… in the query string to target a comment of this post
 *      instead. (Comments have no dedicated route — function budget.)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { query, queryOne, withTransaction } from '../../_lib/db.js';
import {
  fail,
  internal,
  methodNotAllowed,
  notFound,
  unauthorized,
} from '../../_lib/errors.js';
import { readAttendeeSession, type AttendeeSession } from '../../_lib/session.js';
import { EmojiReact, ReactionCreate } from '../../_lib/schemas.js';
import { trigger } from '../../_lib/pusher.js';

interface CountsRow {
  like_count: string;
  dislike_count: string;
}

interface EmojiRow {
  emoji: string;
  n: string;
}

interface MineRow {
  emoji: string;
}

async function aggregateEmoji(
  table: 'post_emoji_reactions' | 'comment_emoji_reactions',
  fkColumn: 'post_id' | 'comment_id',
  targetId: string,
  attendeeId: string
): Promise<{ emojiCounts: Record<string, number>; myEmojis: string[] }> {
  const counts = await query<EmojiRow>(
    `SELECT emoji, count(*)::text AS n FROM ${table} WHERE ${fkColumn} = $1 GROUP BY emoji`,
    [targetId]
  );
  const mine = await query<MineRow>(
    `SELECT emoji FROM ${table} WHERE ${fkColumn} = $1 AND attendee_id = $2`,
    [targetId, attendeeId]
  );
  const emojiCounts: Record<string, number> = {};
  for (const r of counts) emojiCounts[r.emoji] = Number(r.n);
  return { emojiCounts, myEmojis: mine.map((r) => r.emoji) };
}

async function toggleEmoji(
  table: 'post_emoji_reactions' | 'comment_emoji_reactions',
  fkColumn: 'post_id' | 'comment_id',
  targetId: string,
  attendeeId: string,
  emoji: string
): Promise<void> {
  await withTransaction(async (tx) => {
    const existing = await tx.query(
      `SELECT 1 FROM ${table} WHERE ${fkColumn} = $1 AND attendee_id = $2 AND emoji = $3`,
      [targetId, attendeeId, emoji]
    );
    if (existing.length > 0) {
      await tx.query(
        `DELETE FROM ${table} WHERE ${fkColumn} = $1 AND attendee_id = $2 AND emoji = $3`,
        [targetId, attendeeId, emoji]
      );
    } else {
      await tx.query(
        `INSERT INTO ${table} (${fkColumn}, attendee_id, emoji) VALUES ($1, $2, $3)`,
        [targetId, attendeeId, emoji]
      );
    }
  });
}

async function handleEmojiOnPost(
  req: VercelRequest,
  res: VercelResponse,
  session: AttendeeSession,
  postId: string,
  eventId: string
): Promise<void> {
  const parsed = EmojiReact.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
  }
  const emoji = parsed.data.emoji;
  console.log('[posts/reactions] emoji toggle (post)', emoji);

  await toggleEmoji('post_emoji_reactions', 'post_id', postId, session.attendeeId, emoji);
  const agg = await aggregateEmoji(
    'post_emoji_reactions',
    'post_id',
    postId,
    session.attendeeId
  );
  void trigger(eventId, 'post:emoji', { postId, emojiCounts: agg.emojiCounts });
  res.status(200).json({ postId, ...agg });
}

async function handleEmojiOnComment(
  req: VercelRequest,
  res: VercelResponse,
  session: AttendeeSession,
  postId: string,
  eventId: string,
  commentId: string
): Promise<void> {
  const comment = await queryOne<{ id: string }>(
    'SELECT id FROM comments WHERE id = $1 AND post_id = $2',
    [commentId, postId]
  );
  if (!comment) return notFound(res, 'Comment not found.');

  const parsed = EmojiReact.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
  }
  const emoji = parsed.data.emoji;
  console.log('[posts/reactions] emoji toggle (comment)', emoji);

  await toggleEmoji(
    'comment_emoji_reactions',
    'comment_id',
    commentId,
    session.attendeeId,
    emoji
  );
  const agg = await aggregateEmoji(
    'comment_emoji_reactions',
    'comment_id',
    commentId,
    session.attendeeId
  );
  void trigger(eventId, 'comment:emoji', {
    postId,
    commentId,
    emojiCounts: agg.emojiCounts,
  });
  res.status(200).json({ postId, commentId, ...agg });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[posts/reactions]', req.method, 'postId=', req.query.id);
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

    const body = (req.body ?? {}) as Record<string, unknown>;
    const commentId =
      typeof req.query.commentId === 'string' ? req.query.commentId : null;

    // Emoji path (post or comment)
    if ('emoji' in body) {
      if (commentId) {
        return handleEmojiOnComment(req, res, session, postId, post.event_id, commentId);
      }
      return handleEmojiOnPost(req, res, session, postId, post.event_id);
    }

    // ---- like/dislike (post only) ----
    if (commentId) {
      return fail(res, 400, 'BAD_REQUEST', 'like/dislike is post-only; use { emoji } for comments.');
    }

    const parsed = ReactionCreate.safeParse(body);
    if (!parsed.success) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
    }
    const kind = parsed.data.kind;
    console.log('[posts/reactions] toggle', kind, 'attendeeId=', session.attendeeId);

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
