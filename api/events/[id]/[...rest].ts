/**
 * Catch-all for everything under /api/events/:id.
 *
 *   GET    /api/events/:id                 → event by id
 *   GET    /api/events/:id/attendees       → list attendees
 *   POST   /api/events/:id/attendees       → create attendee + cookie
 *   PATCH  /api/events/:id/attendees/me    → update own attendance/plus-one
 *   GET    /api/events/:id/posts?cursor=   → paginated feed
 *   POST   /api/events/:id/posts           → create post
 *   GET    /api/events/:id/poll            → poll counts
 *   POST   /api/events/:id/poll            → cast vote
 *
 * Consolidated to fit the Hobby plan's 12-function ceiling.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isUniqueViolation, query, queryOne } from '../../_lib/db.js';
import {
  conflict,
  fail,
  internal,
  methodNotAllowed,
  notFound,
  tooManyRequests,
  unauthorized,
} from '../../_lib/errors.js';
import { incrWithExpiry } from '../../_lib/kv.js';
import {
  createAttendeeCookie,
  randomToken,
  readAttendeeSession,
} from '../../_lib/session.js';
import {
  AttendeeCreate,
  AttendeePatch,
  PollVote,
  PostCreate,
} from '../../_lib/schemas.js';
import { trigger } from '../../_lib/pusher.js';
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

interface AttendeeRow {
  id: string;
  event_id: string;
  first_name: string;
  last_name: string;
  attendance: 'attending' | 'maybe' | 'no_go';
  plus_one: boolean;
  created_at: string;
}

interface PostRow {
  id: string;
  event_id: string;
  attendee_id: string;
  body: string;
  created_at: string;
  first_name: string;
  last_name: string;
  like_count: number | string;
  dislike_count: number | string;
  comment_count: number | string;
}

interface CountRow {
  choice: 'eat_drink' | 'drink' | 'eat';
  n: string;
}

const POSTS_SQL = `
  SELECT
    p.id, p.event_id, p.attendee_id, p.body, p.created_at,
    a.first_name, a.last_name,
    COALESCE(SUM(CASE WHEN r.kind = 'like'    THEN 1 ELSE 0 END), 0) AS like_count,
    COALESCE(SUM(CASE WHEN r.kind = 'dislike' THEN 1 ELSE 0 END), 0) AS dislike_count,
    (SELECT count(*) FROM comments c WHERE c.post_id = p.id)        AS comment_count
  FROM posts p
  JOIN attendees a ON a.id = p.attendee_id
  LEFT JOIN post_reactions r ON r.post_id = p.id
`;

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

function serializePost(r: PostRow) {
  return {
    id: r.id,
    eventId: r.event_id,
    attendeeId: r.attendee_id,
    body: r.body,
    createdAt: r.created_at,
    author: { firstName: r.first_name, lastName: r.last_name },
    likeCount: Number(r.like_count),
    dislikeCount: Number(r.dislike_count),
    commentCount: Number(r.comment_count),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const eventId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!eventId) return fail(res, 400, 'BAD_ID', 'Missing event id');

  // Vercel @vercel/node v5 exposes catch-all params under the literal key
  // including the leading dots (e.g. "...rest"), and delivers nested paths
  // as a slash-joined string ("attendees/me"), not an array.
  const raw = (req.query['...rest'] ?? req.query.rest) as string | string[] | undefined;
  const path = (Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split('/').filter(Boolean)
      : []) as string[];
  const head = path[0] ?? null;
  console.log('[events catch-all]', req.method, 'eventId=', eventId, 'path=', path);

  try {
    if (head === null) {
      // Bare /api/events/:id is handled by the sibling index.ts. We only
      // reach here if Vercel routed an empty-segment request to the catch-all,
      // which shouldn't happen in normal operation.
      return notFound(res);
    }

    if (head === 'attendees') {
      if (path[1] === 'me') return attendeesMe(req, res, eventId);
      if (path[1] !== undefined) return notFound(res);
      if (req.method === 'GET') return listAttendees(req, res, eventId);
      if (req.method === 'POST') return createAttendee(req, res, eventId);
      return methodNotAllowed(res, ['GET', 'POST']);
    }

    if (head === 'posts') {
      if (path[1] !== undefined) return notFound(res);
      if (req.method === 'GET') return listPosts(req, res, eventId);
      if (req.method === 'POST') return createPost(req, res, eventId);
      return methodNotAllowed(res, ['GET', 'POST']);
    }

    if (head === 'poll') {
      if (path[1] !== undefined) return notFound(res);
      if (req.method === 'GET') return getPoll(req, res, eventId);
      if (req.method === 'POST') return votePoll(req, res, eventId);
      return methodNotAllowed(res, ['GET', 'POST']);
    }

    return notFound(res);
  } catch (err) {
    internal(res, err);
  }
}

// ---------- /api/events/:id/attendees ----------

async function listAttendees(_req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  // Public read: guests (skip-the-gate) and attendees both see the list.
  console.log('[events/attendees] list (public)');
  const rows = await query<AttendeeRow>(
    `SELECT id, event_id, first_name, last_name, attendance, plus_one, created_at
       FROM attendees
      WHERE event_id = $1
      ORDER BY created_at ASC`,
    [eventId]
  );
  res.status(200).json(rows.map(serializeAttendee));
}

async function createAttendee(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  console.log('[events/attendees] create attempt, eventId=', eventId);
  const event = await queryOne<EventRow>(
    `SELECT ${EVENT_COLUMNS} FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event) {
    console.log('[events/attendees] event not found');
    return notFound(res, 'Event not found.');
  }

  const parsed = AttendeeCreate.safeParse(req.body);
  if (!parsed.success) {
    console.log('[events/attendees] validation failed', parsed.error.flatten());
    return fail(res, 400, 'VALIDATION_ERROR', 'Form data invalid.', parsed.error.flatten());
  }
  const { firstName, lastName, attendance, plusOne } = parsed.data;
  console.log('[events/attendees] inserting', firstName, lastName, attendance, 'plusOne=', plusOne);

  const sessionToken = randomToken(32);
  let row: AttendeeRow;
  try {
    const inserted = await queryOne<AttendeeRow>(
      `INSERT INTO attendees (event_id, first_name, last_name, attendance, plus_one, session_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, event_id, first_name, last_name, attendance, plus_one, created_at`,
      [eventId, firstName, lastName, attendance, plusOne, sessionToken]
    );
    if (!inserted) throw new Error('Insert returned no row');
    row = inserted;
  } catch (err) {
    if (isUniqueViolation(err)) {
      return conflict(
        res,
        'NAME_TAKEN',
        'Već attendaš, droljo.'
      );
    }
    throw err;
  }

  const cookie = createAttendeeCookie(row.id, sessionToken);
  console.log('[events/attendees] inserted attendeeId=', row.id, 'cookieLen=', cookie.header.length);

  void trigger(eventId, 'attendee:new', { attendee: serializeAttendee(row) });

  // Atomically write status + Set-Cookie + body so Vercel's runtime can't
  // overwrite Set-Cookie between setHeader and res.end (same fix as the
  // admin OAuth callback).
  const body = JSON.stringify({
    attendee: serializeAttendee(row),
    event: serializeEvent(event),
  });
  res.writeHead(201, {
    'Content-Type': 'application/json; charset=utf-8',
    'Set-Cookie': cookie.header,
  });
  res.end(body);
}

// ---------- PATCH /api/events/:id/attendees/me ----------

async function attendeesMe(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  console.log('[events/attendees/me]', req.method, 'eventId=', eventId);
  if (req.method !== 'PATCH') return methodNotAllowed(res, ['PATCH']);

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
}

// ---------- /api/events/:id/posts ----------

async function listPosts(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  // Public read: guests can view the feed, but only attendees can post.
  console.log('[events/posts] list (public)');
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : null;

  const params: unknown[] = [eventId];
  let where = 'WHERE p.event_id = $1';
  if (cursor) {
    params.push(cursor);
    where += ` AND p.created_at < $${params.length}`;
  }
  params.push(limit);

  const rows = await query<PostRow>(
    `${POSTS_SQL}
       ${where}
       GROUP BY p.id, a.first_name, a.last_name
       ORDER BY p.created_at DESC
       LIMIT $${params.length}`,
    params
  );

  const nextCursor = rows.length === limit ? rows[rows.length - 1].created_at : null;
  res.status(200).json({
    posts: rows.map(serializePost),
    nextCursor,
  });
}

async function createPost(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  const session = await readAttendeeSession(req);
  console.log('[events/posts] create, hasSession=', !!session, 'attendeeId=', session?.attendeeId);
  if (!session) return unauthorized(res);
  if (session.eventId !== eventId) {
    return fail(res, 403, 'WRONG_EVENT', 'Wrong event for this session.');
  }

  const parsed = PostCreate.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
  }

  const count = await incrWithExpiry(`rl:post:${session.attendeeId}`, 10);
  if (count > 1) return tooManyRequests(res, 10);

  const inserted = await queryOne<{ id: string; created_at: string }>(
    `INSERT INTO posts (event_id, attendee_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [eventId, session.attendeeId, parsed.data.body]
  );
  if (!inserted) throw new Error('Insert returned no row');

  const row = await queryOne<PostRow>(
    `${POSTS_SQL}
      WHERE p.id = $1
      GROUP BY p.id, a.first_name, a.last_name`,
    [inserted.id]
  );
  if (!row) throw new Error('Post vanished after insert');

  void trigger(eventId, 'post:new', { post: serializePost(row) });
  res.status(201).json(serializePost(row));
}

// ---------- /api/events/:id/poll ----------

async function pollCounts(eventId: string): Promise<{ eat_drink: number; drink: number; eat: number }> {
  const rows = await query<CountRow>(
    `SELECT choice, count(*)::text AS n
       FROM poll_votes
      WHERE event_id = $1
      GROUP BY choice`,
    [eventId]
  );
  const out = { eat_drink: 0, drink: 0, eat: 0 };
  for (const r of rows) out[r.choice] = Number(r.n);
  return out;
}

async function getPoll(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  // Public read: counts are visible to guests; "mine" is only populated for
  // signed-in attendees.
  const session = await readAttendeeSession(req);
  console.log('[events/poll] get, hasSession=', !!session);
  const c = await pollCounts(eventId);
  let mine: 'eat_drink' | 'drink' | 'eat' | null = null;
  if (session && session.eventId === eventId) {
    const row = await queryOne<{ choice: 'eat_drink' | 'drink' | 'eat' }>(
      `SELECT choice FROM poll_votes WHERE event_id = $1 AND attendee_id = $2`,
      [eventId, session.attendeeId]
    );
    mine = row?.choice ?? null;
  }
  res.status(200).json({ ...c, mine });
}

async function votePoll(req: VercelRequest, res: VercelResponse, eventId: string): Promise<void> {
  const session = await readAttendeeSession(req);
  console.log('[events/poll] vote, hasSession=', !!session, 'attendeeId=', session?.attendeeId);
  if (!session) return unauthorized(res);
  if (session.eventId !== eventId) {
    return fail(res, 403, 'WRONG_EVENT', 'Wrong event for this session.');
  }

  const parsed = PollVote.safeParse(req.body);
  if (!parsed.success) {
    return fail(res, 400, 'VALIDATION_ERROR', 'Body invalid.', parsed.error.flatten());
  }
  await queryOne(
    `INSERT INTO poll_votes (event_id, attendee_id, choice)
     VALUES ($1, $2, $3)
     ON CONFLICT (event_id, attendee_id)
     DO UPDATE SET choice = EXCLUDED.choice, updated_at = now()
     RETURNING event_id`,
    [eventId, session.attendeeId, parsed.data.choice]
  );
  const c = await pollCounts(eventId);
  void trigger(eventId, 'poll:updated', { counts: c });
  res.status(200).json({ ...c, mine: parsed.data.choice });
}
