/**
 * POST /api/admin/upload
 * Returns a Vercel Blob client-upload token so the browser can PUT the
 * header image directly to Blob storage without going through this
 * function. Admin auth required.
 *
 * The client uses @vercel/blob/client `upload()` and points its
 * `handleUploadUrl` at this endpoint.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { internal, methodNotAllowed, unauthorized } from '../_lib/errors';
import { readAdminSession } from '../_lib/session';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  try {
    const admin = await readAdminSession(req);
    if (!admin) return unauthorized(res);

    const body = req.body as HandleUploadBody;

    const result = await handleUpload({
      body,
      request: req as unknown as Request,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        maximumSizeInBytes: MAX_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ uploadedBy: admin.username, pathname }),
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
