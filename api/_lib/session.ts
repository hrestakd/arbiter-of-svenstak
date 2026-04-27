/**
 * Cookie-backed session helpers.
 *
 * Two session kinds:
 *   - attendee_session: opaque token bound to (attendee.id, attendee.session_token)
 *   - admin_session:    opaque token; lookup in KV → { username }
 *
 * Tokens are signed with $SESSION_SECRET (HMAC-SHA256, base64url) so a
 * client can't forge one even if they guess the format.
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { kv } from './kv.js';
import { queryOne } from './db.js';

const ATTENDEE_COOKIE = 'attendee_session';
const ADMIN_COOKIE = 'admin_session';
const ATTENDEE_TTL_DAYS = 60;
const ADMIN_TTL_DAYS = 7;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET is not set');
  return s;
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function randomToken(byteLen = 32): string {
  return b64url(randomBytes(byteLen));
}

function sign(payload: string): string {
  return b64url(createHmac('sha256', secret()).update(payload).digest());
}

/** payload.sig — payload is opaque (URL-safe). */
function pack(payload: string): string {
  return `${payload}.${sign(payload)}`;
}

function unpack(token: string | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payload);
  const a = fromB64url(sig);
  const b = fromB64url(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return payload;
}

export interface Cookie {
  name: string;
  value: string;
  maxAgeSeconds: number;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readCookie(req: { headers: { cookie?: string } }, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name];
}

export function buildSetCookie(c: Cookie & { httpOnly?: boolean; secure?: boolean; path?: string; sameSite?: 'Lax' | 'Strict' | 'None' }): string {
  const parts = [
    `${c.name}=${encodeURIComponent(c.value)}`,
    `Path=${c.path ?? '/'}`,
    `Max-Age=${c.maxAgeSeconds}`,
    `SameSite=${c.sameSite ?? 'Lax'}`,
  ];
  if (c.httpOnly !== false) parts.push('HttpOnly');
  if (c.secure !== false) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

// ---------- Attendee session ----------

export interface AttendeeSession {
  attendeeId: string;
  eventId: string;
  firstName: string;
  lastName: string;
  attendance: 'attending' | 'maybe' | 'no_go';
  plusOne: boolean;
  emoji: string;
}

export function createAttendeeCookie(attendeeId: string, sessionToken: string): { header: string; raw: string } {
  const payload = `att:${attendeeId}:${sessionToken}`;
  const value = pack(payload);
  return {
    raw: value,
    header: buildSetCookie({
      name: ATTENDEE_COOKIE,
      value,
      maxAgeSeconds: ATTENDEE_TTL_DAYS * 24 * 60 * 60,
    }),
  };
}

export async function readAttendeeSession(
  req: { headers: { cookie?: string } }
): Promise<AttendeeSession | null> {
  const raw = readCookie(req, ATTENDEE_COOKIE);
  const payload = unpack(raw);
  if (!payload || !payload.startsWith('att:')) return null;
  const [, attendeeId, sessionToken] = payload.split(':');
  if (!attendeeId || !sessionToken) return null;

  const row = await queryOne<{
    id: string;
    event_id: string;
    first_name: string;
    last_name: string;
    attendance: AttendeeSession['attendance'];
    plus_one: boolean;
    emoji: string;
  }>(
    `SELECT id, event_id, first_name, last_name, attendance, plus_one, emoji
       FROM attendees
      WHERE id = $1 AND session_token = $2`,
    [attendeeId, sessionToken]
  );
  if (!row) return null;
  return {
    attendeeId: row.id,
    eventId: row.event_id,
    firstName: row.first_name,
    lastName: row.last_name,
    attendance: row.attendance,
    plusOne: row.plus_one,
    emoji: row.emoji,
  };
}

export function clearAttendeeCookie(): string {
  return buildClearCookie(ATTENDEE_COOKIE);
}

// ---------- Admin session ----------

export interface AdminSession {
  username: string;
}

const adminKvKey = (token: string) => `admin:session:${token}`;

export async function createAdminSession(username: string): Promise<{ header: string }> {
  const token = randomToken();
  const value = pack(`adm:${token}`);
  await kv().set(adminKvKey(token), { username }, { ex: ADMIN_TTL_DAYS * 24 * 60 * 60 });
  return {
    header: buildSetCookie({
      name: ADMIN_COOKIE,
      value,
      maxAgeSeconds: ADMIN_TTL_DAYS * 24 * 60 * 60,
    }),
  };
}

export async function readAdminSession(
  req: { headers: { cookie?: string } }
): Promise<AdminSession | null> {
  const raw = readCookie(req, ADMIN_COOKIE);
  const payload = unpack(raw);
  if (!payload || !payload.startsWith('adm:')) return null;
  const token = payload.slice(4);
  const stored = await kv().get<{ username: string }>(adminKvKey(token));
  if (!stored) return null;
  return { username: stored.username };
}

export async function destroyAdminSession(
  req: { headers: { cookie?: string } }
): Promise<string> {
  const raw = readCookie(req, ADMIN_COOKIE);
  const payload = unpack(raw);
  if (payload?.startsWith('adm:')) {
    await kv().del(adminKvKey(payload.slice(4)));
  }
  return buildClearCookie(ADMIN_COOKIE);
}
