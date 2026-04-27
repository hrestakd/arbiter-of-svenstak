/**
 * GET  /api/auth/github   — start GitHub OAuth (redirect)
 * GET  /api/auth/callback — finish GitHub OAuth (redirect)
 * GET  /api/auth/me       — return { username } or 401
 * POST /api/auth/logout   — clear admin session
 *
 * Consolidated into one Vercel Function so the project fits the Hobby
 * plan's 12-function ceiling.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '../_lib/kv';
import { queryOne } from '../_lib/db';
import {
  createAdminSession,
  destroyAdminSession,
  randomToken,
  readAdminSession,
} from '../_lib/session';
import {
  fail,
  forbidden,
  internal,
  methodNotAllowed,
  notFound,
  unauthorized,
} from '../_lib/errors';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const action = typeof req.query.action === 'string' ? req.query.action : null;
  try {
    switch (action) {
      case 'github':
        return await github(req, res);
      case 'callback':
        return await callback(req, res);
      case 'me':
        return await me(req, res);
      case 'logout':
        return await logout(req, res);
      default:
        return notFound(res, `Unknown auth action: ${action ?? '(none)'}`);
    }
  } catch (err) {
    internal(res, err);
  }
}

async function github(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error('GITHUB_CLIENT_ID / GITHUB_OAUTH_REDIRECT_URI are not set');
  }

  const state = randomToken(24);
  await kv().set(`oauth:state:${state}`, '1', { ex: 600 });

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');

  res.redirect(302, url.toString());
}

async function callback(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);

  const code = typeof req.query.code === 'string' ? req.query.code : null;
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  if (!code || !state) {
    return fail(res, 400, 'BAD_REQUEST', 'Missing code or state');
  }

  const stateKey = `oauth:state:${state}`;
  const stateVal = await kv().get(stateKey);
  if (!stateVal) {
    return fail(res, 400, 'BAD_STATE', 'OAuth state expired or invalid');
  }
  await kv().del(stateKey);

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = process.env.GITHUB_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('GitHub OAuth env vars are not set');
  }

  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`GitHub token exchange failed: ${tokenRes.status}`);
  }
  const token = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!token.access_token) {
    return fail(res, 400, 'OAUTH_FAILED', token.error ?? 'Token exchange failed');
  }

  const userRes = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'arbiter-of-svenstak',
    },
  });
  if (!userRes.ok) {
    throw new Error(`GitHub user fetch failed: ${userRes.status}`);
  }
  const user = (await userRes.json()) as { login?: string };
  if (!user.login) {
    return fail(res, 400, 'OAUTH_FAILED', 'GitHub returned no login');
  }

  const allowed = await queryOne(
    'SELECT 1 AS ok FROM admins WHERE github_username = $1',
    [user.login]
  );
  if (!allowed) {
    return forbidden(res, `${user.login} is not on the admin allowlist.`);
  }

  const { header } = await createAdminSession(user.login);
  res.setHeader('Set-Cookie', header);
  res.redirect(302, '/admin');
}

async function me(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const admin = await readAdminSession(req);
  if (!admin) return unauthorized(res, 'Not signed in.');
  res.status(200).json({ username: admin.username });
}

async function logout(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const clear = await destroyAdminSession(req);
  res.setHeader('Set-Cookie', clear);
  res.status(204).end();
}
