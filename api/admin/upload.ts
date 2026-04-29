/**
 * POST /api/admin/upload
 *
 * Two flavours, picked by Content-Type:
 *
 *   1. application/json
 *      Returns a Vercel Blob client-upload token via @vercel/blob/client's
 *      `handleUpload`. The browser then PUTs the file directly to Blob
 *      storage. Used by the admin event form.
 *
 *   2. application/octet-stream  (with X-File-Type header)
 *      Reads the raw request body and `put`s it to Blob server-side, then
 *      returns `{ url }`. Used by the post composer. We use octet-stream
 *      because it's the only binary content type @vercel/node's built-in
 *      body parser handles natively (it exposes the Buffer on `req.body`).
 *      Sending as image/* falls back to a stream-replay path inside
 *      `vercel dev` that can stall mid-upload.
 *
 * Either an admin or attendee session is accepted.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { put } from '@vercel/blob';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { fail, internal, methodNotAllowed, unauthorized } from '../_lib/errors.js';
import {
  randomToken,
  readAdminSession,
  readAttendeeSession,
} from '../_lib/session.js';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB (client-upload flow)
const SERVER_MAX_BYTES = 4 * 1024 * 1024; // 4 MB (server-upload flow; Hobby body cap is 4.5 MB)
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

function extensionFor(imageType: string): string {
  switch (imageType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'bin';
  }
}

function sanitizePrefix(raw: string | undefined): string {
  if (!raw) return 'misc';
  const cleaned = raw.replace(/[^a-zA-Z0-9/_-]/g, '-').replace(/\/+/g, '/');
  return cleaned.replace(/^\/+|\/+$/g, '').slice(0, 200) || 'misc';
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  console.log('[admin/upload]', req.method, req.headers['content-type']);
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);

  try {
    const [admin, attendee] = await Promise.all([
      readAdminSession(req),
      readAttendeeSession(req),
    ]);
    const uploader =
      admin?.username ??
      (attendee ? `attendee:${attendee.attendeeId}` : null);
    console.log('[admin/upload] uploader=', uploader);
    if (!uploader) return unauthorized(res);

    const contentType = (req.headers['content-type'] ?? '')
      .split(';')[0]
      .trim()
      .toLowerCase();

    // ---- Server-side direct upload (application/octet-stream) ----
    if (contentType === 'application/octet-stream') {
      const fileTypeHeader = req.headers['x-file-type'];
      const fileType = (Array.isArray(fileTypeHeader) ? fileTypeHeader[0] : fileTypeHeader ?? '')
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (!ALLOWED_IMAGE_TYPES.has(fileType)) {
        return fail(res, 400, 'BAD_FILE_TYPE', `Unsupported X-File-Type: ${fileType || '(missing)'}`);
      }

      const raw = (req as unknown as { body?: unknown }).body;
      const body: Buffer | null = Buffer.isBuffer(raw)
        ? raw
        : typeof raw === 'string'
          ? Buffer.from(raw, 'binary')
          : null;
      if (!body) {
        return fail(res, 400, 'EMPTY_BODY', 'No file content received.');
      }
      if (body.length === 0) {
        return fail(res, 400, 'EMPTY_BODY', 'Empty file.');
      }
      if (body.length > SERVER_MAX_BYTES) {
        return fail(res, 413, 'PAYLOAD_TOO_LARGE', 'File exceeds 4 MB.');
      }

      const prefix = sanitizePrefix(
        typeof req.query.prefix === 'string' ? req.query.prefix : undefined
      );
      const pathname = `${prefix}/${randomToken(8)}.${extensionFor(fileType)}`;
      console.log('[admin/upload] put', { pathname, bytes: body.length, fileType });

      const blob = await put(pathname, body, {
        access: 'public',
        contentType: fileType,
        addRandomSuffix: false,
      });
      console.log('[admin/upload] put done', blob.url);
      return void res.status(200).json({ url: blob.url, pathname: blob.pathname });
    }

    // ---- Client-token flow (application/json) ----
    const body = req.body as HandleUploadBody;
    const result = await handleUpload({
      body,
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: Array.from(ALLOWED_IMAGE_TYPES),
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ uploadedBy: uploader, pathname }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[blob] upload completed', { url: blob.url, tokenPayload });
      },
    });

    res.status(200).json(result);
  } catch (err) {
    internal(res, err);
  }
}
